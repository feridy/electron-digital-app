import { BrowserWindow, IpcMain } from 'electron';
import { SerialPort } from 'serialport';

export async function serialPortList() {
  const list = await SerialPort.list();

  return list;
}

export async function initSerialHandler(mainWindow: BrowserWindow, ipcMain: IpcMain) {
  const list = await SerialPort.list().catch((err) => {
    mainWindow.webContents.send('serial:port:list:error', err);
    return null;
  });

  ipcMain.handle('serial:port:list', () => list);

  if (!list) return;

  if (list && !list.length) {
    mainWindow.webContents.send('serial:port:list:error', 'Not found any serial port');
    return;
  }

  const port = new SerialPort({
    path: list[0].path,
    baudRate: 115200,
    autoOpen: true
  });

  port.on('data', (data) => {
    mainWindow.webContents.send('serial:port:data', data.toString());
  });

  ipcMain.on('serial:port:close', () => {
    port.close();
  });

  ipcMain.on('serial:port:write', (_event, data: string) => {
    port.write(data, 'utf-8', (err) => {
      if (err) mainWindow.webContents.send('serial:port:list:error', err);
    });
  });

  ipcMain.on('serial:port:open', () => {
    port.open((err) => {
      mainWindow.webContents.send('serial:port:list:error', err || 'serial open error');
    });
  });
}
