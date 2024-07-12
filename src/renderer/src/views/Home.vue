<script setup lang="ts">
import { useRouter } from 'vue-router';
import { onMounted, ref } from 'vue';

const sendMessage = ref('');
const isConnect = ref(window.api.tcpConnectState);
const router = useRouter();

function ipcHandle() {
  window.electron.ipcRenderer.send('ping');
}
function onVersionClick() {
  router.push({ path: '/version' });
}
async function selectSerial() {
  const serialPortList = await window.electron.ipcRenderer.invoke('serial:port:list');
  console.log(serialPortList);
}
async function onSendMessage() {
  if (!sendMessage.value.trim()) return;

  try {
    await window.electron.ipcRenderer.invoke('mes:tcp:send', sendMessage.value.trim());
    sendMessage.value = '';
  } catch (error) {
    console.log(error);
  }
}
async function mesTcpClick() {
  if (isConnect.value) {
    window.electron.ipcRenderer.send('mes:tcp:client:close');
  } else {
    window.electron.ipcRenderer.send('mes:tcp:client:connect');
  }
}

onMounted(async () => {
  window.electron.ipcRenderer.on('serial:port:data', (_event, message: string) => {
    console.log(message);
  });

  window.electron.ipcRenderer.on('mes:tcp:connect', () => {
    isConnect.value = true;
  });
  window.electron.ipcRenderer.on('mes:tcp:error', () => {
    isConnect.value = false;
  });
  window.electron.ipcRenderer.on('mes:tcp:close', () => {
    isConnect.value = false;
  });
  window.electron.ipcRenderer.on('mes:tcp:data', (_event, message: string) => {
    console.log(message);
  });

  // selectSerial();
});
</script>

<template>
  <div class="home-wrapper">
    <img alt="logo" class="logo" src="../assets/electron.svg" />
    <div
      class="tcp-status"
      :class="{
        connect: isConnect,
        close: !isConnect
      }"
      @click="mesTcpClick"
    >
      {{ isConnect ? 'CONNECTED' : 'CLOSED' }}
    </div>
    <div class="home-actions">
      <button @click="onVersionClick">Version</button>
      <button @click="ipcHandle">Ping</button>
      <button @click="selectSerial">Test Web Serial API</button>
      <input placeholder="please input message send service" v-model="sendMessage" />
      <button @click="onSendMessage">Send TCP Mes</button>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.home-wrapper {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100vh;
  width: 100vw;
  font-family: sans-serif;
  text-align: center;
  .tcp-status {
    display: flex;
    margin: 20px 0;
    justify-content: center;
    align-items: center;
    min-width: 100px;
    height: 40px;
    padding: 0 10px;
    border-radius: 10px;

    &.connect {
      background-color: #00ff00;
    }

    &.close {
      background-color: #ff0000;
    }
    cursor: pointer;
  }
  /* backdrop-filter: blur(50px); */

  .logo {
    margin-bottom: 60px;
    width: 180px;
    height: 180px;
    cursor: pointer;
    will-change: filter;
    transition: filter 300ms;
    &:hover {
      filter: drop-shadow(0 0 1.2em #6988e6aa);
    }
  }
}
.home-actions {
  display: flex;
  justify-content: center;
  align-items: center;
  font-size: 14px;

  > button {
    display: flex;
    justify-content: center;
    align-items: center;
    margin: 0 5px;
    padding: 0 8px;
    min-width: 80px;
    height: 40px;
    border-radius: 10px;
    border: 2px solid #ccc;
    cursor: pointer;
  }

  > input {
    height: 40px;
    margin: 0 5px;
    border: 2px solid #ccc;
    padding: 0 8px;
    width: 220px;
    border-radius: 10px;
  }
}
</style>
