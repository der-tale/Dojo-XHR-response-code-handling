Handle response codes globally with Dojo's xhr()
================================================

This small js file [monkey patches][monkeypatchwikipedia] the Dojo's original xhr function to globally and synchronously handle server side responses with different status codes other than 200.

For example, if your server session has timed out, this patch allows you to display a login screen and after a successful authentication to automatically re-send the original xhr call to resume the application without any further interruption.

How to use
----------

Download the single js file and include it after dojo.js and before your application code:

```javascript
<script src="js/dojo/dojo.js" type="text/javascript" charset="utf-8"
    djConfig="..."></script>

<script src="js/dojoXhrExtension.js"></script>

<script src="js/yourappcode.js"></script>
```

Before making any xhr calls or initializing any Dijit components which could do that, define your handler functions this way:

```javascript
dojo._handleXhrStatus[401] = {
    retryAfterwards: true, 
    handler: function() {
        var d = new dojo.Deferred()
    
        dojo._xhr("GET", {
            url: "auth/signIn",
            content: {
                username: "administrator",
                password: "god"
            }
        }).then(function(result) {
            d.resolve()
        }, function() {
            d.reject() 
        })

        return d
    }
}
```

If any xhr calls get the response 401, your configured method is invoked. While you handle the event, every other xhr call is paused until you resolve/reject the Deferred. 

You can handle 401s, but also any 5xx code for example. If you cannot resume normal operations afterwards, set retryAfterwards to false to inhibit the xhr call blocking.

Contact / Licence
-----------------

If you find any bugs or have any suggestions, please do not hesitate to drop me an [email][].

This code is licenced under the terms of LGPL Version 3.

[monkeypatchwikipedia]: http://en.wikipedia.org/wiki/Monkey_patch
[email]: mailto:manuel@zamora.de
