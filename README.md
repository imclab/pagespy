## Pagespy

### Installation

```bash
$ npm install pagespy
```

### Usage

Check if a site is using a CDN to serve static assets

```javascript
var Spy = require('pagespy');

var spy = new Spy({
    timeout: 10 * 1000
    retries: 3
});

var url = 'http://fellt.com';

spy.load(url, function (err, page) {
    if (err) throw err;
    page.getCDN(function (err, cdn, which_host) {
        if (err) throw err;
        console.log('It looks like %s is using the %s CDN (via %s)',
            page.getHostname(), cdn, which_host);
    });
});
```

Example output

```
It looks like fellt.com is using the Turbobytes CDN (via c.fellt.com)
```

### License (MIT)

Copyright (c) 2013 Sydney Stockholm <opensource@sydneystockholm.com>

Permission is hereby granted, free of charge, to any person obtaining
a copy of this software and associated documentation files (the
"Software"), to deal in the Software without restriction, including
without limitation the rights to use, copy, modify, merge, publish,
distribute, sublicense, and/or sell copies of the Software, and to
permit persons to whom the Software is furnished to do so, subject to
the following conditions:

The above copyright notice and this permission notice shall be
included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND
NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE
LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION
OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION
WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

