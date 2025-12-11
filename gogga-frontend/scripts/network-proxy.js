#!/usr/bin/env node
/**
 * Network Proxy for Next.js 16 Dev Server
 * 
 * Workaround for Next.js 16 bug where dev server only accepts loopback connections
 * despite binding to 0.0.0.0. This proxy forwards network connections to localhost.
 * 
 * Usage: node scripts/network-proxy.js [listen-port] [target-port]
 * Default: listens on 0.0.0.0:3001 and forwards to 127.0.0.1:3000
 */

const net = require('net');
const os = require('os');

const LISTEN_PORT = parseInt(process.argv[2]) || 3001;
const TARGET_PORT = parseInt(process.argv[3]) || 3000;
const TARGET_HOST = '127.0.0.1';
const LISTEN_HOST = '0.0.0.0';

// Get the machine's network IPs for display
function getNetworkIPs() {
  const interfaces = os.networkInterfaces();
  const ips = [];
  for (const name in interfaces) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        ips.push({ name, address: iface.address });
      }
    }
  }
  return ips;
}

const server = net.createServer((clientSocket) => {
  const targetSocket = net.createConnection(TARGET_PORT, TARGET_HOST, () => {
    clientSocket.pipe(targetSocket);
    targetSocket.pipe(clientSocket);
  });

  targetSocket.on('error', (err) => {
    console.error(`Target connection error: ${err.message}`);
    clientSocket.destroy();
  });

  clientSocket.on('error', (err) => {
    console.error(`Client connection error: ${err.message}`);
    targetSocket.destroy();
  });

  clientSocket.on('close', () => targetSocket.destroy());
  targetSocket.on('close', () => clientSocket.destroy());
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`❌ Port ${LISTEN_PORT} is already in use`);
    process.exit(1);
  }
  console.error(`Server error: ${err.message}`);
});

server.listen(LISTEN_PORT, LISTEN_HOST, () => {
  console.log(`\n🔀 Network Proxy for Next.js 16 Dev Server`);
  console.log(`   Forwarding: 0.0.0.0:${LISTEN_PORT} → ${TARGET_HOST}:${TARGET_PORT}\n`);
  
  const networkIPs = getNetworkIPs();
  if (networkIPs.length > 0) {
    console.log('   Access from network:');
    for (const ip of networkIPs) {
      console.log(`   - http://${ip.address}:${LISTEN_PORT} (${ip.name})`);
    }
  }
  console.log('');
});

process.on('SIGINT', () => {
  console.log('\nShutting down proxy...');
  server.close();
  process.exit(0);
});
