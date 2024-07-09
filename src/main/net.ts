import * as net from 'node:net';

export function connectMesSocket(ip: string, prot: number) {
  return new Promise<net.Socket>((resolve, reject) => {
    const client = net.connect(
      {
        host: ip,
        port: prot
      },
      () => {
        resolve(client);
      }
    );

    client.on('data', (data) => {
      console.log('Received:', data.toString());
    });

    client.on('close', () => {
      console.log('Connection closed');
    });

    client.on('end', () => {
      console.log('Connection ended');
    });

    client.on('error', (err) => {
      console.error('Error:', err.message);
      client.end();
      reject(err);
    });

    client.on('timeout', () => {
      console.log('Connection timed out');
      client.end();
      reject(new Error('Connection timed out'));
    });
  });
}
