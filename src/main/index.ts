import { app, shell, BrowserWindow, ipcMain, globalShortcut } from 'electron';
import path, { join } from 'path';
import { electronApp, optimizer, is } from '@electron-toolkit/utils';
import { initMainLog } from '../log';
import fs from 'fs-extra';
import icon from '../../resources/icon.png?asset';
import { createKeywordSpotter } from './sherpa';
import { mspLogin, qIVWAudioWrite, vwSessionBegin, vwSessionEnd } from './msc';
import { autoUpdater } from 'electron-updater';
// import { mspLogin, vwSessionBegin } from './msc';

// 初始化log文件
const log = initMainLog();

autoUpdater.logger = log;

autoUpdater.forceDevUpdateConfig = import.meta.env.DEV;

autoUpdater.autoDownload = false;

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
  let IS_MSP_LOGIN = true;
  let MSP_SESSION_ID = '';
  if (!IS_MSP_LOGIN) {
    mspLogin(() => {
      IS_MSP_LOGIN = true;
    });
  }

  const kws = await createKeywordSpotter();

  // const recognizer = await createOnlineRecognizer();
  // let recognizerStream: any = null;
  // let lastText = '';
  // let segmentIndex = 0;

  ipcMain.handle('START_WAKE_UP_CHECK', () => {
    return new Promise<string>((resolve) => {
      if (IS_MSP_LOGIN && !MSP_SESSION_ID) {
        vwSessionBegin(
          (errCode, sessionId) => {
            if (!errCode) {
              MSP_SESSION_ID = sessionId;
              resolve(MSP_SESSION_ID);
            }
          },
          (flag) => {
            // 唤醒成功
            console.log(flag);
            // vwSessionEnd(MSP_SESSION_ID, '唤醒成功');
          }
        );
      }
    });
  });

  ipcMain.handle('WAKE_UP_CHECK', async (_, audio: string) => {
    if (IS_MSP_LOGIN && MSP_SESSION_ID) {
      const buffer = Buffer.from(audio, 'base64');
      qIVWAudioWrite(MSP_SESSION_ID, buffer);
    }
    // audio
  });

  ipcMain.handle('WAKE_UP_END', () => {
    if (MSP_SESSION_ID) {
      vwSessionEnd(MSP_SESSION_ID, '手动结束语音唤醒');
      MSP_SESSION_ID = '';
    }
  });

  ipcMain.handle('SAVE_SEND_AUDIO', async (_e, filename: string, data: DataView) => {
    const audioPath = path.join(process.cwd(), './logs/audios', filename);
    await fs.ensureFile(audioPath);
    await fs.writeFile(audioPath, Buffer.from(data.buffer, data.byteOffset, data.byteLength));
    // console.log(kws);

    // await detectedKeyword(audioPath).catch((err) => console.log(err));
  });

  ipcMain.handle('WAKE_UP_PCM', async (_, pcmData: Float32Array) => {
    const stream = kws.createStream();
    stream.acceptWaveform(kws.config.featConfig.sampleRate, pcmData);
    const detectedKeywords: string[] = [];
    while (kws.isReady(stream)) {
      kws.decode(stream);
      const keyword = kws.getResult(stream).keyword;
      if (keyword != '') {
        detectedKeywords.push(keyword);
      }
    }
    console.log(detectedKeywords);
    stream.free();

    return detectedKeywords.length > 0;
  });

  // 渲染进行检查更新
  ipcMain.handle('CHECK_FOR_UPDATE', async () => {
    const result = await autoUpdater.checkForUpdates();
    console.log('----------CHECK_FOR_UPDATE----------');
    // console.log(result);
    return result?.updateInfo.version;
  });
  // 开始进行更新下载
  ipcMain.handle('DOWNLOAD_UPDATE_NOW', async () => {
    console.log('----------DOWNLOAD_UPDATE_NOW----------');
    await autoUpdater.downloadUpdate();
  });
  // 进行更新安装
  ipcMain.handle('INSTALL_UPDATE_NOW', async () => {
    console.log('----------INSTALL_UPDATE_NOW----------');
    autoUpdater.quitAndInstall();
  });

  // 当有新版本更新时，通知渲染进程
  autoUpdater.on('update-available', (info) => {
    console.log('----------update-available----------', info);
    mainWindow.webContents.send('UPDATE_AVAILABLE', info.version);
  });
  // 更新时下载进度
  autoUpdater.on('download-progress', (progressObj) => {
    // progressObj.bytesPerSecond;
    console.log(progressObj);
    mainWindow.webContents.send(
      'UPDATE_PROGRESS',
      progressObj.percent,
      progressObj.bytesPerSecond,
      progressObj.total
    );
  });
  // 更新下载完成
  autoUpdater.on('update-downloaded', () => {
    mainWindow.webContents.send('UPDATE_DOWNLOADED');
  });
  // 更新错误
  autoUpdater.on('error', (err) => {
    mainWindow.webContents.send('UPDATE_ERROR', err);
  });

  // ipcMain.handle('ARS_STREAM_START', () => {
  //   if (recognizerStream) throw new Error('ARS ERROR: STREAM IS NOT END!!');
  //   recognizerStream = recognizer.createStream();
  //   lastText = '';
  //   segmentIndex = 0;
  // });

  // ipcMain.handle('ARS_STREAM_HANDLE', async (_, frame: Float32Array) => {
  //   if (!recognizerStream) {
  //     return;
  //     // recognizerStream = recognizer.createStream();
  //   }
  //   recognizerStream.acceptWaveform(recognizer.config.featConfig.sampleRate, frame);
  //   while (recognizer.isReady(recognizerStream)) {
  //     recognizer.decode(recognizerStream);
  //   }
  //   const isEndpoint = recognizer.isEndpoint(recognizerStream);
  //   const text = recognizer.getResult(recognizerStream).text;

  //   if (text.length > 0) {
  //     lastText = text;
  //   }

  //   if (isEndpoint) {
  //     if (text.length > 0) {
  //       lastText = text;
  //       segmentIndex += 1;
  //     }
  //     recognizer.reset(recognizerStream);
  //   }
  //   if (lastText) console.log(lastText);
  // });

  // ipcMain.handle('ARS_STREAM_END', () => {
  //   if (!recognizerStream) return;
  //   // tail padding
  //   const floatSamples = new Float32Array(recognizer.config.featConfig.sampleRate * 0.5);
  //   recognizerStream.acceptWaveform(recognizer.config.featConfig.sampleRate, floatSamples);
  //   while (recognizer.isReady(recognizerStream)) {
  //     recognizer.decode(recognizerStream);
  //   }
  //   const text = recognizer.getResult(recognizerStream).text;
  //   if (text.length > 0) {
  //     lastText = text;
  //     // console.log(segmentIndex, lastText);
  //   }
  //   console.log(lastText);
  //   recognizerStream?.inputFinished();
  //   recognizerStream?.free();
  //   recognizerStream = null;
  //   console.log(lastText);
  // });

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

  const mainWindow = await createWindow();

  if (import.meta.env.PROD) {
    const ret = globalShortcut.register('Space', () => {
      mainWindow.webContents.send('SPACE_PRESSED');
    });

    if (!ret) {
      console.log('registration failed');
    } else {
      console.log('registration success');
    }
  }

  app.on('activate', async function () {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) await createWindow();
  });
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
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
