const https = require('https');
const http = require('http');
const httpProxy = require('http-proxy');
const fs = require('fs');

// SSL/TLS Certificates
let options;
try {
    options = {
        key: fs.readFileSync('/certs/private.key'),
        cert: fs.readFileSync('/certs/certificate.crt')
    };
} catch (err) {
    options = {
        key: fs.readFileSync('certs/private.key'),
        cert: fs.readFileSync('certs/certificate.crt')
    };
}

// Create a proxy server
const proxy = httpProxy.createProxyServer({});

// Map of routes to backend servers
const targetMap = {
    '/notities': 'http://localhost:8080', // Route `/api` forwarded to backend server 1
    '/admin': 'http://localhost:8085', // Route `/static` forwarded to backend server 2
    '/taart': 'http://localhost:80/taart',
    '/api-docs': 'http://localhost:8080/api-docs/',
    '/assetto': 'http://localhot:8772'
};

const defaultTarget = "http://vps.klimdanick.nl:8085"

// Create the reverse proxy server
const server = https.createServer(options, (req, res) => {
    // Match routes to target servers
    console.log(`request url: ${req.url}`);
    const target = Object.keys(targetMap).find((prefix) =>
        req.url.startsWith(prefix)
    );

    // If route matches, use corresponding target; otherwise, use default
    const proxyTarget = target ? targetMap[target] : defaultTarget;

    // Forward the request to the appropriate target
    const splitIndex = req.url.slice(1).indexOf("/")
    if (splitIndex >= 0) req.url = req.url.slice(splitIndex + 1)
    else req.url = ""
    console.log(`target url: ${proxyTarget}${req.url}`);

    proxy.web(req, res, { target: proxyTarget }, (err) => {
        console.error('Proxy error:', err);
        res.writeHead(500);
        res.end('Internal Server Error');
    });
});

// Listen on port 3000
server.listen(443, () => {
    console.log('Reverse proxy is running on http://localhost:443');
});
