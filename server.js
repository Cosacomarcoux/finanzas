const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const url = require('url');

const PORT = process.env.PORT || 3000;
const SHEETS_URL = 'https://script.google.com/macros/s/AKfycbzE_0j8BkkSZnVwCvZqxmq-Z-rtRkoUbBGQOjbFKz0BcGYcf7Sra-yKnVXWOK3inv4nyA/exec';

function followRedirects(reqUrl, options, body, res, depth) {
  if (depth > 5) { res.writeHead(500); res.end('Too many redirects'); return; }
  const u = new url.URL(reqUrl);
  const opts = {
    hostname: u.hostname,
    path: u.pathname + u.search,
    method: options.method,
    headers: options.headers
  };
  const req = https.request(opts, (apiRes) => {
    if ([301,302,303,307,308].includes(apiRes.statusCode) && apiRes.headers.location) {
      followRedirects(apiRes.headers.location, {...options, method: apiRes.statusCode===303?'GET':options.method}, body, res, depth+1);
      return;
    }
    let data = '';
    apiRes.on('data', chunk => data += chunk);
    apiRes.on('end', () => {
      res.writeHead(apiRes.statusCode, {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      });
      res.end(data);
    });
  });
  req.on('error', e => { res.writeHead(500); res.end(JSON.stringify({ok:false,error:e.message})); });
  if (body) req.write(body);
  req.end();
}

http.createServer((req, res) => {
  const parsed = url.parse(req.url);

  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Allow-Methods': 'POST, GET, OPTIONS'
    });
    res.end(); return;
  }

  // GET /api/sheets → leer datos
  if (parsed.pathname === '/api/sheets' && req.method === 'GET') {
    followRedirects(SHEETS_URL + '?nocache=' + Date.now(), {
      method: 'GET',
      headers: { 'Accept': 'application/json' }
    }, null, res, 0);
    return;
  }

  // POST /api/sheets → guardar movimiento
  if (parsed.pathname === '/api/sheets' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      followRedirects(SHEETS_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) }
      }, body, res, 0);
    });
    return;
  }

  // Servir HTML
  fs.readFile(path.join(__dirname, 'index.html'), (err, data) => {
    if (err) { res.writeHead(500); res.end('Error'); return; }
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(data);
  });

}).listen(PORT, () => console.log('Puerto ' + PORT));
