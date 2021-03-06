// Monkey patched dojo.xhr() function to globally handle respone codes != 20x

// handler functions
//
// format:
//
// code: { retryAfterwards: boolean, handler: function }
// eg:
// 401: { retryAfterwards: true, handler: function() { ... } }
//
// the handler function has to return a deferred
//
dojo._handleXhrStatus = {}

// hold flag
dojo._holdXhr = false

// response codes to handle, automatically populated from _handleXhrStatus
dojo._handleWhichXhrResponseCodes = []

// backup original xhr function
dojo._xhr = dojo.xhr

// let the monkeys go wild
dojo.xhr = function(method, args, hasBody) {
    var state = "first"
    var deferredForCaller = new dojo.Deferred()

    // store ioargs in deferredForCaller to fix several dojo stores
    // (eg. dojox.data.JsonRestStore)
    deferredForCaller.ioArgs = args

    // which response codes should we handle
    var handleCodeArray = []
    for (code in dojo._handleXhrStatus) {
        handleCodeArray.push(code)
    }

    if (handleCodeArray.length > dojo._handleWhichXhrResponseCodes.length)
        dojo._handleWhichXhrResponseCodes = handleCodeArray

    // use handle from xhr object to always receive the ioargs object
    // this will be unnecessary in dojo 1.7, as then the xhr object will be
    // returned via the deferred
    //
    // TODO: call handle function when resolving/rejecting deferredForCaller
    //
    args._handle = args.handle
    args.handle = function(response, ioargs) {

        // update ioargs in deferredForCaller with current value
        deferredForCaller.ioArgs = ioargs

        if (ioargs.xhr.status >= 200 && ioargs.xhr.status <= 299) {
            deferredForCaller.resolve(response)

            // also call return handle
            if (typeof(args._handle) == "function") {
                args._handle(response, ioargs) 
            }
        }
        else {
            response.ioargs = ioargs 

            try {
                if (ioargs.handleAs == "json") {
                    ioargs.xhr.responseJson = dojo.fromJson(ioargs.xhr.response) 
                    response.json = ioargs.xhr.responseJson
                }
            } catch (e) {
                response.ioargs = ioargs
                handleError(response)
            }
            
            handleError(response)
        }
    }

    // execute xhr call, on success resolve original deferred, otherwise
    // call the error handler
    var doXhr = function() {
        dojo._xhr(method, args, hasBody)
    }

    // handle the xhr error. if a handle function is supplied, otherwise
    // reject the orignal deferred
    var handleError = function(error) {

        // first, execute the xhr call 
        if (state == "first") {

            // is there already an authentication process going on?
            if (dojo._holdXhr == true) {
                
                waitForXhrAllowed().then(function() {
                    state = "second"
                    doXhr()
                })

            } else if (dojo.indexOf(dojo._handleWhichXhrResponseCodes, error.status) > -1) {
                // handle codes

                // should we retry afterwards?
                if (dojo._handleXhrStatus[error.status]["retryAfterwards"] == true) {
                    dojo._holdXhr = true

                    doHandle(error.status).then(function() {
                        // successful handling, try xhr call again

                        state = "second"
                        dojo._holdXhr = false
                        doXhr()

                    }, function() {
                        // unsucessful handling, reject the original deferred

                        dojo._holdXhr = false
                        deferredForCaller.reject(error) 
                    })

                } else {
                    doHandle(error.status)
                    deferredForCaller.reject(error)
                }

            } else {

                // for any other response code, resolve with an error
                deferredForCaller.reject(error) 
            }

        } else {

            // second xhr call failed again, resolve with an error
            deferredForCaller.reject(error) 
        }
    }

    // encapsulate user supplied login function
    var doHandle = function(code) {
        return dojo._handleXhrStatus[code]["handler"]()
    }

    // check dojo._holdXhr periodically
    var waitForXhrAllowed = function() {
        var intervalDeferred = new dojo.Deferred()
        var interval

        if (dojo._holdXhr == false) intervalDeferred.resolve()
        else {
            interval = window.setInterval(function() {
                if (dojo._holdXhr == false) {
                    window.clearInterval(interval) 
                    intervalDeferred.resolve()
                } 
            }, 50)
        }

        return intervalDeferred
    }

    // "main":
    waitForXhrAllowed().then(function() {
        doXhr()
    })

    return deferredForCaller
}
