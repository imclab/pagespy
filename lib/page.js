var url = require('url')
  , async = require('async')
  , resolve = require('path').resolve
  , debug = require('debug')('pageload:spy')
  , cdns = require('./cdn')
  , parse = url.parse
  , build = url.format;

/**
 * Common regex patterns.
 */

var url_protocol = /^([a-z0-9]+?):?\/\//i
  , static_asset = /\.(jpe?g|css|js|gif|png)$/i;

/**
 * Create a new page instance.
 *
 * @param {Object} request
 * @param {Object} dns
 * @param {String} url
 * @param {HTTPResponse} response
 * @param {String} body
 */

function Page(request, dns, url, response, body) {
    this.request = request;
    this.dns = dns;
    this.url = url;
    this.url_parts = parse(url);
    this.response = response;
    this.body = body;
}

module.exports = Page;

/**
 * Get the size of the body.
 *
 * @return {Number}
 */

Page.prototype.getBodySize = function () {
    return this.body.length;
};

/**
 * Get the hostname of the page.
 *
 * @return {String}
 */

Page.prototype.getHostname = function () {
    return this.url_parts.hostname;
};

/**
 * Check whether a hostname is a subdomain of the page's hostname.
 *
 * @param {String} hostname
 * @param {Boolean}
 */

Page.prototype.isSubdomain = function (hostname) {
    var page_hostname = this.url_parts.hostname.replace(/^www\./, '')
      , suffix = new RegExp(page_hostname.replace(/\./g, '\\.') + '$', 'i');
    return suffix.test(hostname);
};

/**
 * Build a URL using the page URL as a base
 *
 * @param {Object} replacements
 * @return {String}
 */

Page.prototype.buildURL = function (replacements) {
    var url = {}, key;
    for (key in this.url_parts) {
        url[key] = this.url_parts[key];
    }
    for (key in replacements) {
        url[key] = replacements[key];
    }
    var hash = url.path.split('#')
      , query = hash[0].split('?');
    url.hash = hash[1];
    url.search = query[1];
    url.pathname = query[0];
    return build(url);
};

/**
 * Get all resources on the page.
 *
 * @return {Array}
 */

Page.prototype.getResources = function () {
    if (!this.resources) {
        var src_href = / (?:href|src)=("|')([^\1]+?)\1/ig
          , resources = []
          , resource, match;
        while ((match = src_href.exec(this.body))) {
            resource = match[2];
            if (resource.indexOf('//') === 0) {
                resource = this.url_parts.protocol + resource;
            } else if (!url_protocol.test(resource)) {
                resource = this.buildURL({
                    path: resolve(this.url_parts.pathname, resource)
                });
            }
            resources.push(resource);
        }
        this.resources = resources;
    }
    return this.resources;
};

/**
 * Get resources on a page, grouped by hostname.
 *
 * @return {Array} resources - [ { hostname: <hostname>, resources: [...] }, ...]
 */

Page.prototype.getResourcesByHost = function () {
    var resources = this.getResources()
      , grouped = {};
    resources.forEach(function (resource) {
        var hostname = parse(resource).hostname;
        if (!(hostname in grouped)) {
            grouped[hostname] = [];
        }
        grouped[hostname].push(resource);
    });
    var grouped_array = [];
    for (var hostname in grouped) {
        grouped_array.push({ hostname: hostname, resources: grouped[hostname] });
    }
    grouped_array.sort(function (a, b) {
        return a.resources.length < b.resources.length ? 1 : -1;
    });
    return grouped_array;
};

/**
 * Get static assets on a page, grouped by hostname.
 *
 * @return {Array} resources - [ { hostname: <hostname>, resources: [...] }, ...]
 */

Page.prototype.getStaticAssetsByHost = function () {
    var grouped = this.getResourcesByHost();
    grouped.forEach(function (group) {
        group.resources = group.resources.filter(function (resource) {
            var url = resource.split('?')[0].split('#')[0];
            return static_asset.test(url);
        });
    });
    grouped = grouped.filter(function (group) {
        return group.resources.length > 1;
    });
    grouped.sort(function (a, b) {
        return a.resources.length < b.resources.length ? 1 : -1;
    });
    return grouped;
};

/**
 * Get CDN name based on a host.
 *
 * @param {String} hostname
 * @param {String} cdn_name
 */

Page.prototype.getCDNByHostname = function (hostname) {
    var cdn, i, pattern;
    for (cdn in cdns) {
        for (i = 0; i < cdns[cdn].length; i++) {
            pattern = cdns[cdn][i];
            if (pattern.test(hostname)) {
                debug('Hostname %s is %s based on pattern %s', hostname, cdn, pattern);
                return cdn;
            }
        }
    }
};

/**
 * Check whether the page is using a CDN.
 *
 * @param {Function} callback - receives (err, cdn_name)
 */

Page.prototype.getCDN = function (callback) {
    var assets = this.getStaticAssetsByHost()
      , self = this;

    //Filter out hosts with less than 3 static assets
    var hosts = assets.filter(function (group) {
        return group.resources.length >= 3;
    }).map(function (group) {
        return group.hostname;
    });

    //Find subdomains that are hosting static assets
    var subdomains = hosts.filter(function (hostname) {
        return self.isSubdomain(hostname);
    });

    debug('Checking subdomain CNAME(s): %j', subdomains);

    //Do a CNAME lookup on any subdomains
    var cnames = {};
    async.each(subdomains, function (subdomain, next) {
        self.dns.resolveCname(subdomain, function (err, cnames_) {
            if (cnames_ && cnames_.length) {
                debug('Subdomain %s has CNAME(s): %j', subdomain, cnames_);
                cnames[subdomain] = cnames_;
            }
            next();
        });
    }, function () {
        var cdn, i, subdomain;

        //Check if any of the subdomains are a CNAME link to a CDN
        for (subdomain in cnames) {
            for (i = 0; i < cnames[subdomain].length; i++) {
                cdn = self.getCDNByHostname(cnames[subdomain][i]);
                if (cdn) {
                    return callback(null, cdn, subdomain);
                }
            }
        }

        //Try the remaining hosts
        var external_hosts = hosts.filter(function (hostname) {
            return !self.isSubdomain(hostname);
        });
        debug('Checking if external hosts are CDNs: %j', external_hosts);
        for (i = 0; i < external_hosts.length; i++) {
            cdn = self.getCDNByHostname(external_hosts[i]);
            if (cdn) {
                return callback(null, cdn, external_hosts[i]);
            }
        }

        //Finally, do a CNAME lookup on any external hosts
        cnames = {};
        async.each(external_hosts, function (host, next) {
            self.dns.resolveCname(host, function (err, cnames_) {
                if (cnames_ && cnames_.length) {
                    debug('External host %s has CNAME(s): %j', host, cnames_);
                    cnames[host] = cnames_;
                }
                next();
            });
        }, function () {
            for (var host in cnames) {
                for (i = 0; i < cnames[host].length; i++) {
                    cdn = self.getCDNByHostname(cnames[host][i]);
                    if (cdn) {
                        return callback(null, cdn, host);
                    }
                }
            }

            //Couldn't find a CDN :(
            callback();
        });
    });
};

