const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');

const certPath = path.resolve(__dirname, '../certs/cert.pem');
const keyPath = path.resolve(__dirname, '../certs/key.pem');

if (!fs.existsSync(certPath) || !fs.existsSync(keyPath)) {
  console.error('TLS cert or key not found in ./certs');
  process.exit(1);
}

const cert = fs.readFileSync(certPath);
const key = fs.readFileSync(keyPath);

const TARGET_PORT = process.env.TARGET_PORT ? Number(process.env.TARGET_PORT) : 3001;
const LISTEN_PORT = process.env.LISTEN_PORT ? Number(process.env.LISTEN_PORT) : 3000;

const server = https.createServer({ key, cert }, (req, res) => {
  const options = {
    hostname: '127.0.0.1',
    port: TARGET_PORT,
    path: req.url,
    method: req.method,
    headers: req.headers,
  };

  const proxy = http.request(options, (pres) => {
    res.writeHead(pres.statusCode || 200, pres.headers);
    pres.pipe(res, { end: true });
  });

  proxy.on('error', (err) => {
    res.writeHead(502, { 'Content-Type': 'text/plain' });
    res.end('Bad Gateway: ' + err.message);
  });

  req.pipe(proxy, { end: true });
});

server.on('clientError', (err, socket) => {
  console.error('clientError', err.message);
  socket.end('HTTP/1.1 400 Bad Request\r\n\r\n');
});

server.listen(LISTEN_PORT, () => {
  console.log(`TLS proxy listening on https://0.0.0.0:${LISTEN_PORT} -> http://127.0.0.1:${TARGET_PORT}`);
});

process.on('SIGINT', () => process.exit(0));
