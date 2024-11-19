import { ElectronAPI } from '@electron-toolkit/preload';

export interface Api {
  tcpConnectState: boolean;
  getVideos: () => Promise<{ video: string; index: string; cover: string }[]>;
  getConfigs: () => Promise<any>;
}

declare global {
  interface Window {
    electron: ElectronAPI;
    api: Api;
    vad: any;
  }
}
