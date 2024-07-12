import { ElectronAPI } from '@electron-toolkit/preload';

export interface Api {
  tcpConnectState: boolean;
}

declare global {
  interface Window {
    electron: ElectronAPI;
    api: Api;
  }
}
