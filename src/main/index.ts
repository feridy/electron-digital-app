import { app, shell, BrowserWindow, ipcMain } from 'electron';
import path, { join } from 'path';
import { electronApp, optimizer, is } from '@electron-toolkit/utils';
import { initMainLog } from '../log';
import fs from 'fs-extra';
import icon from '../../resources/icon.png?asset';
// import { mspLogin, qIVWAudioWrite, vwSessionBegin, vwSessionEnd } from './msc';
// import { mspLogin, vwSessionBegin } from './msc';

// 初始化log文件
const log = initMainLog();

async function createWindow() {
  // Create the browser window.
  const mainWindow = new BrowserWindow({
    width: 1920,
    height: 1200,
    fullscreen: !is.dev,
    fullscreenable: !is.dev,
    show: false,
    autoHideMenuBar: true,
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      backgroundThrottling: false,
      sandbox: false
    }
  });

  mainWindow.on('ready-to-show', () => {
    mainWindow.show();
  });

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url);
    return { action: 'deny' };
  });

  // HMR for renderer base on electron-vite cli.
  // Load the remote URL for development or the local html file for production.
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL']);
    mainWindow.webContents.openDevTools({ mode: 'right' });
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'));
  }

  // vwSessionBegin();
  // let IS_MSP_LOGIN = false;
  // let MSP_SESSION_ID = '';
  // if (!IS_MSP_LOGIN) {
  //   mspLogin(() => {
  //     IS_MSP_LOGIN = true;
  //   });
  // }

  // ipcMain.handle('START_WAKE_UP_CHECK', () => {
  //   return new Promise<string>((resolve) => {
  //     setTimeout(() => {
  //       if (IS_MSP_LOGIN && !MSP_SESSION_ID) {
  //         vwSessionBegin(
  //           (errCode, sessionId) => {
  //             if (!errCode) {
  //               MSP_SESSION_ID = sessionId;
  //               resolve(MSP_SESSION_ID);
  //             }
  //           },
  //           (flag) => {
  //             // 唤醒成功
  //             console.log(flag);
  //             // vwSessionEnd(MSP_SESSION_ID, '唤醒成功');
  //           }
  //         );
  //       }
  //     }, 10);
  //   });
  // });

  // ipcMain.handle('WAKE_UP_CHECK', async (_, audio: string) => {
  //   if (IS_MSP_LOGIN && MSP_SESSION_ID) {
  //     const buffer = Buffer.from(audio, 'base64');
  //     qIVWAudioWrite(MSP_SESSION_ID, buffer);
  //   }
  //   // audio
  // });

  // ipcMain.handle('WAKE_UP_END', () => {
  //   if (MSP_SESSION_ID) {
  //     vwSessionEnd(MSP_SESSION_ID, '手动结束语音唤醒');
  //     MSP_SESSION_ID = '';
  //   }
  // });

  ipcMain.handle('SAVE_SEND_AUDIO', async (e, filename: string, data: DataView) => {
    const logPath = path.join(process.cwd(), './logs/audios', filename);
    await fs.ensureFile(logPath);
    await fs.writeFile(logPath, Buffer.from(data.buffer, data.byteOffset, data.byteLength));
  });

  return mainWindow;
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(async () => {
  // Set app user model id for windows
  electronApp.setAppUserModelId('com.electron');

  // Default open or close DevTools by F12 in development
  // and ignore CommandOrControl + R in production.
  // see https://github.com/alex8088/electron-toolkit/tree/master/packages/utils
  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window);
  });

  // IPC test
  ipcMain.on('ping', () => console.log('pong'));

  await createWindow();

  app.on('activate', function () {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }

  log.info('..........程序退出..........');
});

// In this file you can include the rest of your app"s specific main process
// code. You can also put them in separate files and require them here.
