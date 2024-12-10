import { contextBridge } from 'electron';
import { electronAPI } from '@electron-toolkit/preload';
import path from 'path';
import fs from 'fs-extra';
import url from 'url';

// Custom APIs for renderer
const api = {
  tcpConnectState: false,
  getVideos: async () => {
    const dir = path.join(process.cwd(), './videos');
    const result = (await fs.readdir(dir)).map((item) => path.join(dir, item));
    const videos = result.filter((item) => ['.mp4'].includes(path.parse(item).ext));
    const covers = result.filter((item) => ['.jpg', 'jpeg', '.png'].includes(path.parse(item).ext));
    return videos.map((item) => {
      const { name } = path.parse(item);
      const cover = covers.find((cover) => {
        return path.parse(cover).name.split('_').slice(-1)[0] === name.split('_').slice(-1)[0];
      });
      const videoPath = url.pathToFileURL(item).href;
      const coverPath = cover ? url.pathToFileURL(cover).href : null;
      console.log(videoPath);
      return {
        index: name.split('_').slice(-1)[0],
        video: import.meta.env.DEV ? videoPath.replace('file://', '/@fs') : videoPath,
        cover: import.meta.env.DEV ? coverPath?.replace('file://', '/@fs') : coverPath
      };
    });
  },
  getConfigs: async () => {
    const json = await fs.readJSON(path.join(process.cwd(), './configs/index.config.json'));
    return json;
  },
  checkForUpdate: async () => {
    const version = electronAPI.ipcRenderer.invoke('CHECK_FOR_UPDATE');
    return version;
  },
  startDownloadUpdate: async () => {
    await electronAPI.ipcRenderer.invoke('DOWNLOAD_UPDATE_NOW');
  },
  startInstallUpdate: async () => {
    await electronAPI.ipcRenderer.invoke('INSTALL_UPDATE_NOW');
  },
  execute: (...args) => electronAPI.ipcRenderer.invoke('db:execute', ...args)
};

// Use `contextBridge` APIs to expose Electron APIs to
// renderer only if context isolation is enabled, otherwise
// just add to the DOM global.
if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI);
    contextBridge.exposeInMainWorld('api', api);
  } catch (error) {
    console.error(error);
  }
} else {
  // @ts-ignore (define in dts)
  window.electron = electronAPI;
  // @ts-ignore (define in dts)
  window.api = api;
}
