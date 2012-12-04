var http = require("http"),
    httpProxy = require("http-proxy"),
    url = require("url"),
    sys = require("sys"),
    net = require("net");


var port = 8080;

// end of settings

var cache = {};

function cacheKey(req) {
  return req.method + " " + req.url;
}

function cacheable(req, res) {
  return req.method == "GET" && res.statusCode == 200;
}

function logRequest(req, cached) {
  sys.puts((cached ? "HIT" : "MISS") + " " + req.method + " " + req.url);
}

server = httpProxy.createServer( function (req, res, proxy) {
  var cacheObject = cache[cacheKey(req)];

  logRequest(req, cacheObject);

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
        port: uri.port || 80
      }
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

server.on("connect", function(req, socket, head) {
  logRequest(req, false);

  // URL is in the form 'hostname:port'
  var parts = req.url.split(':', 2);
  // open a TCP connection to the remote host
  var conn = net.connect(parts[1], parts[0], function() {
    // respond to the client that the connection was made
    socket.write("HTTP/1.1 200 OK\r\n\r\n");
    // create a tunnel between the two hosts
    socket.pipe(conn);
    conn.pipe(socket);
  });
});

server.listen(port);
