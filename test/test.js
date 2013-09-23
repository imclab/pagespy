var modularity = require('modularity')
  , request = require('request')
  , express = require('express')
  , path = require('path')
  , url = require('url')
  , dns = require('dns')
  , next_port = 12345
  , test = exports;

//Disable listener warnings
process.setMaxListeners(10000);

//Work out the location of the lib modules
var lib_dir = path.resolve(path.join(__dirname, '..', 'lib'));

//Provide a helper for loading modules
test.inject = function (inject, callback) {
    if (typeof inject === 'function') {
        callback = inject;
        inject = {};
    }
    inject.options = inject.options || {};
    inject.request = inject.request || request;
    inject.dns = inject.dns || dns;
    modularity
        .include(lib_dir)
        .inject(inject)
        .load(callback);
};

//Create a request instance which routes all requests to
//an express server listening on an ephemeral port
test.mock = function (callback) {
    var port = next_port++;
    function mockRequest(params, callback) {
        if (typeof params === 'string') {
            params = { url: params };
        }
        var parts = url.parse(params.url);
        params.url = 'http://localhost:' + port + parts.path;
        return request(params, callback);
    }
    var app = express();
    test.servers.push(app.listen(port));
    callback(app, mockRequest);
};

//Keep track of test servers
test.servers = [];
test.complete = function (done) {
    test.servers.forEach(function (server) {
        server.close();
    });
    test.servers = [];
    done();
};

