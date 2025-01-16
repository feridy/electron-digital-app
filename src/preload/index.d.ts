import { ElectronAPI } from '@electron-toolkit/preload';

export interface Api {
  tcpConnectState: boolean;
  /**
   * 更新事件key
   */
  updaterEventKeys: Readonly<typeof UpdaterEventKeys>;
  getVideos: () => Promise<{ video: string; index: string; cover: string }[]>;
  getConfigs: () => Promise<any>;
  checkForUpdate: () => Promise<string | null>;
  startDownloadUpdate: () => Promise<void>;
  startInstallUpdate: () => Promise<void>;
}

declare global {
  interface Window {
    electron: ElectronAPI;
    api: Api;
    vad: any;
  }
}
