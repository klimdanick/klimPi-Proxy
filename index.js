const https = require('https');
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
    '/notities': 'http://vps.klimdanick.nl:8080', // Route `/api` forwarded to backend server 1
    '/admin': 'https://vps.klimdanick.nl', // Route `/static` forwarded to backend server 2
};

// Create the reverse proxy server
const server = http.createServer(options, (req, res) => {
    // Match routes to target servers
    const target = Object.keys(targetMap).find((prefix) =>
        req.url.startsWith(prefix)
    );

    if (target) {
        // Forward the request to the appropriate target
        proxy.web(req, res, { target: targetMap[target] }, (err) => {
            console.error('Proxy error:', err);
            res.writeHead(500);
            res.end('Internal Server Error');
        });
    } else {
        // If no route matches, return 404
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('Not Found');
    }
});

// Listen on port 3000
server.listen(8085, () => {
    console.log('Reverse proxy is running on http://localhost:8085');
});