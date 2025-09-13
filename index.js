const https = require('https');
const httpProxy = require('http-proxy');
const fs = require('fs');
const args = { port: 443 };

for (let i = 2; i < process.argv.length; i++) {
  if (process.argv[i].startsWith("--")) {
    args[process.argv[i].substring(2)] = process.argv[i + 1];
    i += 2;
  }
}

let options;
try {
    options = {
        key: fs.readFileSync('/etc/letsencrypt/live/vps.klimdanick.nl-0002/privkey.pem'),
        cert: fs.readFileSync('/etc/letsencrypt/live/vps.klimdanick.nl-0002/fullchain.pem')
    };
} catch (err) {
    options = {
        key: fs.readFileSync('certs/private.key'),
        cert: fs.readFileSync('certs/certificate.crt')
    };
}

const proxy = httpProxy.createProxyServer({ ws: true });

let defaultTarget = "";

// Function to load target mapping dynamically
const loadTargetMap = () => {
    let targetMap = {};
    try {
        let data = JSON.parse(fs.readFileSync("../processes.json"));
        let processes = data["processes"] || [];
        let proxyData = data["proxy"] || [];

        for (let i = 1; i < processes.length; i++) {
            let p = processes[i];
            if (!p.viaProxy) continue;
            let target = `http://localhost:${p.port}`;
            targetMap[p.url] = target;
            if (p.default) defaultTarget = target;
        }

        for (let i = 0; i < proxyData.length; i++) {
            let p = proxyData[i];
            let target = `http://localhost:${p.port}`;
            targetMap[p.url] = target;
            if (p.default) defaultTarget = target;
        }
    } catch (err) {
        console.error("Error loading processes.json:", err);
    }
    return targetMap;
};

// HTTPS Server with Reverse Proxy
const server = https.createServer(options, (req, res) => {
    console.log(`Request: ${req.url} from ${req.socket.remoteAddress}`);

    let targetMap = loadTargetMap();
    const target = Object.keys(targetMap).find((prefix) => req.url.startsWith(prefix));
    let splitIndex = target ? target.length : 0;
    if (target && target.endsWith("/")) splitIndex -= 1;
    const proxyTarget = target ? targetMap[target] : defaultTarget;

    if (splitIndex >= 0) req.url = req.url.slice(splitIndex);
    
    console.log(`Proxying to: ${proxyTarget}${req.url}`);

    try {
        proxy.web(req, res, { target: proxyTarget }, (err) => {
            console.error('Proxy error:', err);
            res.writeHead(502);
            res.end('Bad Gateway');
        });
    } catch (err) {
        console.error('Proxy error:', err);
    }
});

// WebSocket Support for Socket.IO
server.on('upgrade', (req, socket, head) => {
    console.log(`WebSocket Upgrade: ${req.url}`);
    
    let targetMap = loadTargetMap();
    const target = Object.keys(targetMap).find((prefix) => req.url.startsWith(prefix));
    let splitIndex = target ? target.length : 0;
    if (target && target.endsWith("/")) splitIndex -= 1;
    const proxyTarget = target ? targetMap[target] : defaultTarget;

    if (splitIndex >= 0) req.url = req.url.slice(splitIndex);

    console.log(`Proxying WebSocket to: ${proxyTarget}${req.url}`);
    
    try {
        proxy.ws(req, socket, head, { 
            target: proxyTarget, 
            changeOrigin: true, 
            ws: true 
        });
    } catch (err) {
        console.error('WebSocket Proxy Error:', err);
    }
});

// Error Handling
proxy.on('error', (err, req, res) => {
    console.error('Proxy error:', err);
    if (res && !res.headersSent) {
        res.writeHead(502);
        res.end('Bad Gateway');
    }
});

// Start Server
server.listen(args.port, () => {
    console.log(`Reverse proxy is running on port ${args.port}`);
});
