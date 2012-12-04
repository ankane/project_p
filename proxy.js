var http = require("http"),
    httpProxy = require("http-proxy"),
    url = require("url"),
    sys = require("sys");


var port = 8080;

// end of settings

var cache = {};

function cacheKey(req) {
  return req.method + " " + req.url;
}

function cacheable(req, res) {
  return req.method == "GET" && res.statusCode == 200;
}

server = httpProxy.createServer( function (req, res, proxy) {
  var cacheObject = cache[cacheKey(req)];

  // log method and url
  sys.puts((cacheObject ? "HIT" : "MISS") + " " + req.method + " " + req.url);

  if (cacheObject) {
    // do the opposite of what proxyRequest does
    res.writeHead(cacheObject.statusCode, cacheObject.headers);
    for (var i in cacheObject.buffer) {
      res.write(cacheObject.buffer[i]);
    }
    res.end();
  }
  else {
    uri = url.parse(req.url);
    https = uri.protocol == "https"

    var _writeHead = res.writeHead;
    res.writeHead = function(statusCode, headers) {
      res.headers = headers;
      _writeHead.call(res, statusCode, headers);
    }
    res.buffer = []
    var _write = res.write;
    res.write = function(data) {
      res.buffer.push(data);
      _write.call(res, data);
    }

    proxy.proxyRequest(req, res, {
      target: {
        host: uri.host,
        port: uri.port || (https ? 443 : 80),
        https: https
      },
      buffer: httpProxy.buffer(req)
    });
  }
});

server.proxy.on("end", function(req, res) {
  if (cacheable(req, res)) {
    cache[cacheKey(req)] = {
      statusCode: res.statusCode,
      headers: res.headers,
      buffer: res.buffer
    };
  }
});

server.listen(port);
