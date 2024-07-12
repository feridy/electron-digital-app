import { contextBridge } from 'electron';
import { electronAPI } from '@electron-toolkit/preload';

// Custom APIs for renderer
const api = {
  tcpConnectState: false,
  execute: (...args) => electronAPI.ipcRenderer.invoke('db:execute', ...args)
};

// Use `contextBridge` APIs to expose Electron APIs to
// renderer only if context isolation is enabled, otherwise
// just add to the DOM global.
if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI);
    contextBridge.exposeInMainWorld('api', api);
    electronAPI.ipcRenderer.on('mes:tcp:connect', () => {
      api.tcpConnectState = true;
      electronAPI.ipcRenderer.send('mes:tcp:connect', api.tcpConnectState);
    });
  } catch (error) {
    console.error(error);
  }
} else {
  // @ts-ignore (define in dts)
  window.electron = electronAPI;
  // @ts-ignore (define in dts)
  window.api = api;
}
