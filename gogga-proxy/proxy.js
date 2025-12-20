#!/usr/bin/env node
/**
 * Network Proxy for Next.js 16 Dev Server
 * 
 * Workaround for Next.js 16 bug where dev server only accepts loopback connections
 * despite binding to 0.0.0.0. This proxy forwards network connections to the frontend container.
 */

const net = require('net');
const tls = require('tls');
const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');

const LISTEN_PORT = 3001;
const TARGET_PORT = 3000;
// Use host.docker.internal to reach the host machine from Docker container
// Falls back to localhost for non-Docker environments
const TARGET_HOST = process.env.TARGET_HOST || 'host.docker.internal';
const LISTEN_HOST = '0.0.0.0';
const USE_TLS = process.env.USE_TLS === 'true';
const SERVE_TLS = process.env.SERVE_TLS === 'true';

// Load certs for serving HTTPS
let serverOptions = {};
if (SERVE_TLS) {
  try {
    serverOptions = {
      key: fs.readFileSync(process.env.TLS_KEY || '/app/certs/key.pem'),
      cert: fs.readFileSync(process.env.TLS_CERT || '/app/certs/cert.pem'),
    };
  } catch (e) {
    console.error('Failed to load TLS certs for server:', e.message);
    process.exit(1);
  }
}

let connectionCount = 0;

function handleConnection(clientSocket) {
  connectionCount++;
  const connId = connectionCount;
  
  let targetSocket;
  
  if (USE_TLS) {
    // Connect via TLS (for HTTPS dev server)
    targetSocket = tls.connect({
      port: TARGET_PORT,
      host: TARGET_HOST,
      rejectUnauthorized: false, // Accept self-signed certs
    }, () => {
      console.log(`[${connId}] TLS connected to ${TARGET_HOST}:${TARGET_PORT}`);
      clientSocket.pipe(targetSocket);
      targetSocket.pipe(clientSocket);
    });
  } else {
    // Plain TCP connection
    targetSocket = net.createConnection(TARGET_PORT, TARGET_HOST, () => {
      console.log(`[${connId}] Connected to ${TARGET_HOST}:${TARGET_PORT}`);
      clientSocket.pipe(targetSocket);
      targetSocket.pipe(clientSocket);
    });
  }

  targetSocket.on('error', (err) => {
    console.error(`[${connId}] Target error: ${err.message}`);
    clientSocket.destroy();
  });

  clientSocket.on('error', (err) => {
    if (err.code !== 'ECONNRESET') {
      console.error(`[${connId}] Client error: ${err.message}`);
    }
    targetSocket.destroy();
  });

  clientSocket.on('close', () => targetSocket.destroy());
  targetSocket.on('close', () => clientSocket.destroy());
}

// Create server based on SERVE_TLS setting
const server = SERVE_TLS 
  ? tls.createServer(serverOptions, handleConnection)
  : net.createServer(handleConnection);

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`❌ Port ${LISTEN_PORT} is already in use`);
    process.exit(1);
  }
  console.error(`Server error: ${err.message}`);
});

server.listen(LISTEN_PORT, LISTEN_HOST, () => {
  const proto = SERVE_TLS ? 'https' : 'http';
  console.log(`🔀 GOGGA Network Proxy`);
  console.log(`   Forwarding: 0.0.0.0:${LISTEN_PORT} → ${TARGET_HOST}:${TARGET_PORT}`);
  console.log(`   Mode: ${SERVE_TLS ? 'HTTPS→HTTPS' : USE_TLS ? 'HTTP→HTTPS' : 'HTTP→HTTP'}`);
  console.log(`   Access: ${proto}://192.168.0.130:${LISTEN_PORT}`);
  console.log(`   Ready for connections...`);
});

// Health check endpoint for Docker (http already imported at top)
http.createServer((req, res) => {
  if (req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'healthy', connections: connectionCount }));
  } else {
    res.writeHead(404);
    res.end();
  }
}).listen(3002, '0.0.0.0');

process.on('SIGINT', () => {
  console.log('\nShutting down proxy...');
  server.close();
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\nReceived SIGTERM, shutting down...');
  server.close();
  process.exit(0);
});
