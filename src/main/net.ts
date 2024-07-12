import { BrowserWindow, IpcMain } from 'electron';
import * as net from 'node:net';

export function connectMesSocket(
  ip: string,
  prot: number,
  mainWindow: BrowserWindow,
  ipcMain: IpcMain
) {
  const client = net.connect(
    {
      host: ip,
      port: prot
    },
    () => {
      mainWindow.webContents.send('mes:tcp:connect', true);
      // mainWindow.webContents.session
    }
  );

  ipcMain.handle('mes:tcp:send', async (_event, data: string) => {
    return new Promise<void>((resolve, reject) => {
      client.write(data, (err) => {
        if (err) return reject(err);
        resolve();
      });
    });
  });

  ipcMain.on('mes:tcp:client:connect', () => {
    client.connect({
      port: 3000
    });
  });

  ipcMain.on('mes:tcp:client:close', () => {
    console.log('mes:tcp:client:close');
    client.end();
  });

  client.on('connect', () => {
    console.log('Connected to the server');
    mainWindow.webContents.send('mes:tcp:connect', true);
  });

  client.on('data', (data) => {
    console.log('Received:', data.toString());
    const str = data.toString();
    mainWindow.webContents.send('mes:tcp:data', str);
  });

  client.on('close', () => {
    console.log('Connection closed');
    mainWindow.webContents.send('mes:tcp:close');
  });

  client.on('end', () => {
    console.log('Connection ended');
  });

  client.on('error', (err) => {
    console.error('Error:', err.message);
    client.end();
    mainWindow.webContents.send('mes:tcp:error', err);
  });

  client.on('timeout', () => {
    console.log('Connection timed out');
    client.end();
    mainWindow.webContents.send('mes:tcp:error', new Error('timeout'));
  });
}
