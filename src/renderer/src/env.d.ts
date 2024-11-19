/// <reference types="vite/client" />

interface Api {
  tcpConnectState: boolean;
  getVideos: () => Promise<{ video: string; index: string; cover: string }[]>;
  getConfigs: () => Promise<any>;
}

declare module '*.vue' {
  import type { DefineComponent } from 'vue';
  // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/ban-types
  const component: DefineComponent<{}, {}, any>;
  export default component;
}

interface Window {
  token?: string;
  api: Api;
}
