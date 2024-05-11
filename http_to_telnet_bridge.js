const http = require('http');
const querystring = require('querystring');
const net = require('net');

let telnetClient;
let longPollingClients = [];

const server = http.createServer((req, res) => {
  
  if (req.url === '/') {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(`
     <!DOCTYPE html>
<html>
<head>
  <title>Telnet connect</title>
</head>
<body>
  <h1>Telnet Browser</h1>
  <form id="connectForm" action="/connect" method="post">
    <label for="host">Host:</label>
    <input type="text" name="host" required>
    <label for="port">Port:</label>
    <input type="number" name="port" required>
    <input type="submit" value="Connect">
  </form>
</body>
</html>
    `);
  } else if (req.url === '/connect' && req.method === 'POST') {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk.toString();
    });
    req.on('end', () => {
      console.log('Received body:', body);
      const { host, port } = querystring.parse(body);
      console.log('Connecting to Telnet server at', host, port);
      telnetClient = new net.Socket(); 
      telnetClient.connect(port, host, () => {
        console.log('Connected to Telnet server');
        res.writeHead(302, { 'Location': '/console' });
        res.end();
      });
    });
  } else if (req.url === '/console' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(`
<!DOCTYPE html>
<html>
<head>
  <title>Telnet Console</title>
</head>
<body>
  <textarea id="terminal" autofocus readonly></textarea>
  <form id="commandForm" action="/send-command" method="post">
    <input type="text" id="commandInput" name="command" required>
    <button type="submit">Send</button>
  </form>
  <script>
    var terminal = document.getElementById('terminal');

    function updateTerminal(text) {
      terminal.value += text; // Append response to the terminal
      terminal.scrollTop = terminal.scrollHeight; // Scroll to the bottom
    }

    function poll() {
      fetch('/poll')
        .then(response => response.text())
        .then(data => {
          updateTerminal(data);
          poll(); // Poll again for more data
        })
        .catch(error => {
          console.error('Error polling:', error);
        });
    }
    poll(); // Start polling for data
  </script>
</body>
</html>
    `);
  } else if (req.url === '/send-command' && req.method === 'POST') {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk.toString();
    });
    req.on('end', () => {
      console.log('Received command:', body);
      if (telnetClient && !telnetClient.destroyed) {
        const command = Buffer.from(body.trim(), 'utf-8'); // Encode the command as UTF-8
        telnetClient.write(command + '\r\n'); // Send the command to the Telnet server
        res.writeHead(200, { 'Content-Type': 'text/plain' });
        res.end('Command sent');
      } else {
        console.error('Telnet client is not connected or not initialized.');
        res.writeHead(500, { 'Content-Type': 'text/plain' });
        res.end('Error: Telnet client is not connected or not initialized.');
      }
    });
  } else if (req.url === '/poll' && req.method === 'GET') {
    longPollingClients.push(res);
  } else {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not found');
  }
});

server.listen(8080, () => {
  console.log('HTTP server is running at http://localhost:8080');
});

setInterval(() => {
  if (telnetClient && !telnetClient.destroyed) {
    telnetClient.on('data', (data) => {
      const decodedData = Buffer.from(data, 'binary').toString('utf8'); // Specify the character encoding here
      longPollingClients.forEach((client) => {
        client.writeHead(200, { 'Content-Type': 'text/plain' });
        client.end(decodedData);
      });
      longPollingClients = [];
    });
  }
}, 1000);
