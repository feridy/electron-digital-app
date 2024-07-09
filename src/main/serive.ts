import * as net from 'node:net';

function createTCPService() {
  const service = net.createServer();

  service.listen(3000);

  service.on('connection', (socket) => {
    console.log('Client connected');

    socket.on('data', (data) => {
      const message = data.toString();
      console.log('Received:', data.toString());
      socket.write(`Hello from server, you sent: ${message}.`);
    });

    socket.on('close', () => {
      console.log('Client disconnected');
    });
  });
}

createTCPService();
