var assert = require('assert')
  , test = require('./test');

describe('Pagespy', function () {

    it('should load a page', function (done) {
        test.mock(function (app, mockRequest) {
            var body = '<html><body>Foo</body></html>';
            app.get('/', function (request, response) {
                response.setHeader('Content-type', 'text/html');
                response.send(body);
            });
            test.inject({ request: mockRequest }, function (spy) {
                spy.load('http://foo.com', function (err, page) {
                    assert.ifError(err);
                    assert.equal(page.url, 'http://foo.com');
                    assert.equal(page.response.headers['content-type'], 'text/html');
                    assert.equal(page.body, body);
                    assert.equal(page.getBodySize(), body.length);
                    assert.equal(page.getHostname(), 'foo.com');
                    test.complete(done);
                });
            });
        });
    });

    it('should fail when a page can\'t be loaded', function (done) {
        function mockRequest(options, callback) {
            callback(new Error('foo'));
        }
        test.inject({ request: mockRequest }, function (spy) {
            spy.load('http://foo.com', function (err) {
                assert(err);
                assert.equal(err.message, 'foo');
                test.complete(done);
            });
        });
    });

    it('should fail on invalid protocol', function (done) {
        test.inject(function (spy) {
            spy.load('ftp://foo.com', function (err) {
                assert(err);
                assert.equal(err.message, 'Invalid protocol: ftp');
                test.complete(done);
            });
        });
    });

    it('should fail on a non-200 response', function (done) {
        test.mock(function (app, mockRequest) {
            app.get('/', function (request, response) {
                response.send(404);
            });
            test.inject({ request: mockRequest }, function (spy) {
                spy.load('http://foo.com', function (err) {
                    assert(err);
                    assert.equal(err.message, 'http://foo.com responded with a 404');
                    test.complete(done);
                });
            });
        });
    });

    it('should retry loading a page for a configurable number of retries', function (done) {
        var options = { retries: 3 }
          , fail_times;
        function mockRequest(options, callback) {
            if (!fail_times) {
                return callback();
            }
            fail_times--;
            callback(new Error('foo'));
        }
        test.inject({ options: options, request: mockRequest }, function (spy) {
            fail_times = 3;
            spy.load('http://foo.com', function (err, page) {
                assert.ifError(err);
                assert.equal(page.url, 'http://foo.com');
                fail_times = 4;
                spy.load('http://foo.com', function (err) {
                    assert(err);
                    assert.equal(err.message, 'foo');
                    test.complete(done);
                });
            });
        });
    });

    it('should normalise input urls', function (done) {
        test.mock(function (app, mockRequest) {
            app.get('/', function (request, response) {
                response.send(200);
            });
            test.inject({ request: mockRequest }, function (spy) {
                spy.load('foo.com', function (err, page) {
                    assert.ifError(err);
                    assert.equal(page.url, 'http://foo.com');
                    test.complete(done);
                });
            });
        });
    });

    it('should find resources on a page', function (done) {
        test.mock(function (app, mockRequest) {
            var body = [
                '<a href="qux.jpg"></a>'
              , '<img SRC=\'/foobar.jpg\' />'
              , '<link href="//foo.com/style.css" />'
              , '<img src="../baz.jpg?foo#bar" />'
              , '<img src="https://baz.com" />'
            ].join('');
            app.get('/bar', function (request, response) {
                response.send(body);
            });
            test.inject({ request: mockRequest }, function (spy) {
                spy.load('foo.com/bar', function (err, page) {
                    assert.ifError(err);
                    assert.equal(page.url, 'http://foo.com/bar');
                    var resources = page.getResources();
                    assert.deepEqual(resources, [
                        'http://foo.com/bar/qux.jpg'
                      , 'http://foo.com/foobar.jpg'
                      , 'http://foo.com/style.css'
                      , 'http://foo.com/baz.jpg?foo#bar'
                      , 'https://baz.com'
                    ]);
                    var grouped = page.getResourcesByHost();
                    assert.deepEqual(grouped, [
                        { hostname: 'foo.com'
                        , resources: [
                            'http://foo.com/bar/qux.jpg'
                          , 'http://foo.com/foobar.jpg'
                          , 'http://foo.com/style.css'
                          , 'http://foo.com/baz.jpg?foo#bar'
                        ]},
                        { hostname: 'baz.com'
                        , resources: [
                            'https://baz.com'
                        ]}
                    ]);
                    var assets = page.getStaticAssetsByHost();
                    assert.deepEqual(assets, [
                        { hostname: 'foo.com'
                        , resources: [
                            'http://foo.com/bar/qux.jpg'
                          , 'http://foo.com/foobar.jpg'
                          , 'http://foo.com/style.css'
                          , 'http://foo.com/baz.jpg?foo#bar'
                        ]}
                    ]);
                    test.complete(done);
                });
            });
        });
    });

    it('should find out if a page is using a CDN by checking subdomain CNAMEs', function (done) {
        var dns = { resolveCname: function (hostname, callback) {
            if (hostname === 'c.foo.com') {
                return callback(null, [ 'foobar.turbobytes.com' ]);
            } else if (hostname === 'b.foo.com') {
                return callback();
            } else if (hostname === 'a.foo.com') {
                return callback(null, [ 'not-a-cdn-k.com' ]);
            }
            return callback({ code: 'ENODATA' });
        }};
        test.mock(function (app, mockRequest) {
            var body = [
                '<a href="http://akamai.disqus.com/some.js"></a>'
              , '<a href="http://foo.com/qux.jpg"></a>'
              , '<a href="http://foo.com/bar.jpg"></a>'
              , '<a href="http://foo.com/baz.jpg"></a>'
              , '<a href="http://b.foo.com/qux.jpg"></a>'
              , '<a href="http://b.foo.com/bar.jpg"></a>'
              , '<a href="http://b.foo.com/baz.jpg"></a>'
              , '<a href="http://a.foo.com/qux.jpg"></a>'
              , '<a href="http://a.foo.com/bar.jpg"></a>'
              , '<a href="http://a.foo.com/baz.jpg"></a>'
              , '<img src="http://c.foo.com/foobar.jpg" />'
              , '<img src="http://c.foo.com/foobaz.jpg" />'
              , '<img src="http://c.foo.com/fooqux.jpg" />'
            ].join('');
            app.get('/', function (request, response) {
                response.send(body);
            });
            test.inject({ dns: dns, request: mockRequest }, function (spy) {
                spy.load('foo.com', function (err, page) {
                    assert.ifError(err);
                    page.getCDN(function (err, cdn, which_host) {
                        assert.ifError(err);
                        assert.equal(cdn, 'Turbobytes');
                        assert.equal(which_host, 'c.foo.com');
                        test.complete(done);
                    });
                });
            });
        });
    });

    it('should find out if a page is using a CDN by checking external hosts', function (done) {
        test.mock(function (app, mockRequest) {
            var body = [
                '<a href="http://akamai.disqus.com/some.js"></a>'
              , '<a href="http://baz.com/qux.jpg"></a>'
              , '<a href="http://baz.com/bar.jpg"></a>'
              , '<a href="http://baz.com/baz.jpg"></a>'
              , '<a href="http://foo.turbobytes.com/qux.jpg"></a>'
              , '<a href="http://foo.turbobytes.com/bar.jpg"></a>'
              , '<a href="http://foo.turbobytes.com/baz.jpg"></a>'
            ].join('');
            app.get('/', function (request, response) {
                response.send(body);
            });
            test.inject({ request: mockRequest }, function (spy) {
                spy.load('foo.com', function (err, page) {
                    assert.ifError(err);
                    page.getCDN(function (err, cdn, which_host) {
                        assert.ifError(err);
                        assert.equal(cdn, 'Turbobytes');
                        assert.equal(which_host, 'foo.turbobytes.com');
                        test.complete(done);
                    });
                });
            });
        });
    });

    it('should return null if a cdn can\'t be determined', function (done) {
        test.mock(function (app, mockRequest) {
            var body = [
                '<a href="http://akamai.disqus.com/some.js"></a>'
              , '<a href="http://baz.com/qux.jpg"></a>'
              , '<a href="http://baz.com/bar.jpg"></a>'
              , '<a href="http://baz.com/baz.jpg"></a>'
            ].join('');
            app.get('/', function (request, response) {
                response.send(body);
            });
            test.inject({ request: mockRequest }, function (spy) {
                spy.load('foo.com', function (err, page) {
                    assert.ifError(err);
                    page.getCDN(function (err, cdn) {
                        assert.ifError(err);
                        assert(!cdn);
                        test.complete(done);
                    });
                });
            });
        });
    });

});

