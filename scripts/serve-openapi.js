#!/usr/bin/env node

/**
 * Simple script to serve OpenAPI file locally using swagger-ui
 * Usage: node scripts/serve-openapi.js
 */

const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 3001;
const openApiPath = path.join(__dirname, '..', 'openapi.yaml');

const swaggerUiHtml = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Onboarding Studio API</title>
  <link rel="stylesheet" type="text/css" href="https://unpkg.com/swagger-ui-dist@5.9.0/swagger-ui.css" />
  <style>
    html {
      box-sizing: border-box;
      overflow: -moz-scrollbars-vertical;
      overflow-y: scroll;
    }
    *, *:before, *:after {
      box-sizing: inherit;
    }
    body {
      margin:0;
      background: #fafafa;
    }
  </style>
</head>
<body>
  <div id="swagger-ui"></div>
  <script src="https://unpkg.com/swagger-ui-dist@5.9.0/swagger-ui-bundle.js"></script>
  <script src="https://unpkg.com/swagger-ui-dist@5.9.0/swagger-ui-standalone-preset.js"></script>
  <script>
    window.onload = function() {
      const ui = SwaggerUIBundle({
        url: "/openapi.yaml",
        dom_id: '#swagger-ui',
        deepLinking: true,
        presets: [
          SwaggerUIBundle.presets.apis,
          SwaggerUIStandalonePreset
        ],
        plugins: [
          SwaggerUIBundle.plugins.DownloadUrl
        ],
        layout: "StandaloneLayout"
      });
    };
  </script>
</body>
</html>
`;

const server = http.createServer((req, res) => {
  if (req.url === '/' || req.url === '/index.html') {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(swaggerUiHtml);
  } else if (req.url === '/openapi.yaml') {
    fs.readFile(openApiPath, 'utf8', (err, data) => {
      if (err) {
        res.writeHead(500, { 'Content-Type': 'text/plain' });
        res.end('Error reading OpenAPI file: ' + err.message);
        return;
      }
      res.writeHead(200, { 'Content-Type': 'application/x-yaml' });
      res.end(data);
    });
  } else {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not found');
  }
});

server.listen(PORT, () => {
  console.log(`\n🚀 OpenAPI documentation server running at:`);
  console.log(`   http://localhost:${PORT}\n`);
  console.log(`📝 Open your browser and navigate to the URL above`);
  console.log(`   Press Ctrl+C to stop the server\n`);
});
