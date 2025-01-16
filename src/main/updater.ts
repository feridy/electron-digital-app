import log from 'electron-log/main';
import { autoUpdater } from 'electron-updater';
import { ipcMain, BrowserWindow } from 'electron';

export enum UpdaterEventKeys {
  DOWNLOAD_UPDATE_NOW = 'DOWNLOAD_UPDATE_NOW',
  INSTALL_UPDATE_NOW = 'INSTALL_UPDATE_NOW',
  UPDATE_DOWNLOADED = 'UPDATE_DOWNLOADED',
  CHECK_FOR_UPDATE = 'CHECK_FOR_UPDATE',
  UPDATE_AVAILABLE = 'UPDATE_AVAILABLE',
  UPDATE_PROGRESS = 'UPDATE_PROGRESS',
  UPDATE_ERROR = 'UPDATE_ERROR'
}

/**
 * 初始化程序更新
 *
 * @param mainWindow 主窗口
 */
export function initUpdater(mainWindow: BrowserWindow) {
  const updateLog = log.scope('Updater');
  autoUpdater.logger = updateLog;

  autoUpdater.forceDevUpdateConfig = import.meta.env.DEV;
  // 要进行手动的更新
  autoUpdater.autoDownload = false;
  // autoUpdater.forceDevUpdateConfig = import.meta.env.DEV;
  updateLog.log('-------------初始化更新器-----------');

  // 当有新版本更新时，通知渲染进程
  autoUpdater.on('update-available', async (info) => {
    updateLog.log('----------通知渲染进程更新的版本----------', info);
    mainWindow.webContents.send(UpdaterEventKeys.UPDATE_AVAILABLE, info.version);
    //将配置文件保存在用户数据目录，解决更新后配置文件丢失的文件
  });

  // 更新时下载进度
  autoUpdater.on('download-progress', (progressObj) => {
    // progressObj.bytesPerSecond;
    updateLog.log(progressObj);
    mainWindow.webContents.send(
      UpdaterEventKeys.UPDATE_PROGRESS,
      progressObj.percent,
      progressObj.bytesPerSecond,
      progressObj.total
    );
  });

  // 更新下载完成
  autoUpdater.on('update-downloaded', () => {
    mainWindow.webContents.send(UpdaterEventKeys.UPDATE_DOWNLOADED);
  });

  // 渲染进行检查更新
  ipcMain.handle(UpdaterEventKeys.CHECK_FOR_UPDATE, async () => {
    const result = await autoUpdater.checkForUpdates();
    updateLog.log('----------检查更新----------');
    return result?.updateInfo.version;
  });

  // 开始进行更新下载
  ipcMain.handle(UpdaterEventKeys.DOWNLOAD_UPDATE_NOW, async () => {
    updateLog.log('----------开始进行更新下载----------');
    await autoUpdater.downloadUpdate();
  });

  // 进行更新安装
  ipcMain.handle(UpdaterEventKeys.INSTALL_UPDATE_NOW, async () => {
    updateLog.log('----------开始进行更新安装----------');
    autoUpdater.quitAndInstall();
  });
}
