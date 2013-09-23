var request_ = require('request')
  , dns_ = require('dns')
  , Page = require('./page');

/**
 * Common regex patterns.
 */

var url_protocol = /^([a-z0-9]+?):?\/\//i;

/**
 * Create a new spy instance.
 *
 * @param {Object} options (optional_
 * @param {Object} request (optional)
 * @param {Object} dns (optiona)
 */

function Spy(options, request, dns) {
    if (!(this instanceof Spy)) {
        return new Spy(options, request, dns);
    }
    options = options || {};
    this.retries = options.retries;
    this.timeout = options.timeout;
    this.request = request || request_;
    this.dns = dns || dns_;
}

module.exports = Spy;

/**
 * Load a url an return a page instance for further analysis.
 *
 * @param {Function} callback - receives (err, page)
 */

Spy.prototype.load = function (url, callback) {
    var retries = this.retries
      , self = this;
    if (!url_protocol.test(url)) {
        url = 'http://' + url;
    } else {
        var protocol = RegExp.$1.toLowerCase();
        if (protocol !== 'http' && protocol !== 'https') {
            return callback(new Error('Invalid protocol: ' + protocol));
        }
    }
    var options = {
        url: url
      , headers: {
            'user-agent': 'Pageload.io'
          , 'accept-encoding': 'identity;q=1.0, *;q=0'
        }
      , timeout: this.timeout
    };
    (function doRequest() {
        self.request(options, function (err, response, body) {
            if (!err && response && Math.floor(response.statusCode / 100) !== 2) {
                err = new Error(url + ' responded with a ' + response.statusCode);
            }
            if (err) {
                if (retries) {
                    retries--;
                    return doRequest();
                }
                return callback(err);
            }
            callback(null, new Page(self.request, self.dns, url, response, body));
        });
    })();
};

