import { ElectronAPI } from '@electron-toolkit/preload';

export interface Api {
  tcpConnectState: boolean;
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
