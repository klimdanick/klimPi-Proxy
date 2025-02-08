const https = require('https');
const http = require('http');
const httpProxy = require('http-proxy');
const fs = require('fs');
let args = {"port": 8085};

for (let i = 2; i < process.argv.length; i++) {
  if (process.argv[i].startsWith("--")) {
    args[process.argv[i].substring(2)] = process.argv[i+1];
    i+=2;
  }
}

let options;
// SSL/TLS Certificates
try {
    options = {
        key: fs.readFileSync('/etc/letsencrypt/archive/vps.klimdanick.nl/privkey1.pem'),
        cert: fs.readFileSync('/etc/letsencrypt/archive/vps.klimdanick.nl/cert1.pem')
    };
} catch (err) {
    options = {
        key: fs.readFileSync('certs/private.key'),
        cert: fs.readFileSync('certs/certificate.crt')
    };
}

// Create a proxy server
const proxy = httpProxy.createProxyServer({});

let defaultTarget = ""

// Create the reverse proxy server
const server = https.createServer(options, (req, res) => {

    let targetMap = {};

    let data = JSON.parse(fs.readFileSync("../processes.json"));
    console.log(data);
    let processes = data["processes"];
    let proxyData = data["proxy"];
    for (let i = 1; i < processes.length; i++) {
        let p = processes[i];
        if (!p.viaProxy) continue;
        let target = `http://localhost:${p.port}`;
        targetMap[p.url] = target;
        if (p.default) defaultTarget = target;
    }
    for (let i = 1; i < proxyData.length; i++) {
        let p = proxyData[i];
        let target = `http://localhost:${p.port}`;
        targetMap[p.url] = target;
        if (p.default) defaultTarget = target;
    }

    console.log(targetMap);

    // Match routes to target servers
    console.log(`request url: ${req.url}, ${req.socket.remoteAddress}, ${new Date().toISOString()}`);
    const target = Object.keys(targetMap).find((prefix) =>
        req.url.startsWith(prefix)
    );

    // If route matches, use corresponding target; otherwise, use default
    let splitIndex = target ? target.length : 0;
    if (target && target.endsWith("/")) splitIndex -= 1;
    const proxyTarget = target ? targetMap[target] : defaultTarget;

    // Forward the request to the appropriate target
    if (splitIndex >= 0) req.url = req.url.slice(splitIndex)
    //else req.url = ""
    console.log(`target url: ${proxyTarget}${req.url}`);

    if (req.headers['upgrade'] && req.headers['upgrade'].toLowerCase() === 'websocket') {
        console.log('WebSocket request detected');
        
        // Proxy the WebSocket upgrade request to your WebSocket server
        try {
            proxy.ws(req, res, { target: proxyTarget });
        } catch(err) {}
        return;
    }
    try {
        proxy.web(req, res, { target: proxyTarget }, (err) => {
            console.error('Proxy error:', err);
            res.writeHead(500);
            res.end('Internal Server Error');
        });
    } catch(err) {}
});

// Listen for WebSocket connections (proxy will handle upgrades)
server.on('upgrade', (req, socket, head) => {

    let targetMap = {};

    let data = JSON.parse(fs.readFileSync("../processes.json"));
    console.log(data);
    let processes = data["processes"];
    let proxyData = data["proxy"];
    for (let i = 1; i < processes.length; i++) {
        let p = processes[i];
        if (!p.viaProxy) continue;
        let target = `http://localhost:${p.port}`;
        targetMap[p.url] = target;
    }
    for (let i = 1; i < proxyData.length; i++) {
        let p = proxyData[i];
        let target = `http://localhost:${p.port}`;
        targetMap[p.url] = target;
        if (p.default) defaultTarget = target;
    }

    // Match routes to target servers
    console.log(`request url: ${req.url}, ${req.socket.remoteAddress}, ${new Date().toISOString()}`);
    const target = Object.keys(targetMap).find((prefix) =>
        req.url.startsWith(prefix)
    );

    // If route matches, use corresponding target; otherwise, use default
    let splitIndex = target ? target.length : 0;
    if (target && target.endsWith("/")) splitIndex -= 1;
    const proxyTarget = target ? targetMap[target] : defaultTarget;

    // Forward the request to the appropriate target
    if (splitIndex >= 0) req.url = req.url.slice(splitIndex)
    //else req.url = ""
    console.log(`target url: ${proxyTarget}${req.url}`);
    try {
        proxy.ws(req, socket, head, { target: proxyTarget });
    } catch(err) {}
});

// Listen on port 3000
server.listen(args.port, () => {
    console.log(`Reverse proxy is running on port ${args.port}`);
});
