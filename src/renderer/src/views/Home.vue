<script setup lang="ts">
import { RouterLink } from 'vue-router';
import { onMounted } from 'vue';
const ipcHandle = () => window.electron.ipcRenderer.send('ping');
async function selectSerial() {
  try {
    await (window.navigator as any).serial.requestPort();
  } catch (ex: any) {
    if (ex.name === 'NotFoundError') {
      console.log('No device found');
      // document.getElementById('device-name').innerHTML = 'Device NOT found';
    } else {
      console.log(ex);
      // document.getElementById('device-name').innerHTML = ex;
    }
  }
}

onMounted(() => {
  // selectSerial();
});
</script>

<template>
  <div class="home-wrapper">
    <img alt="logo" class="logo" src="../assets/electron.svg" />
    <div class="home-actions">
      <RouterLink to="/version">Version</RouterLink>
      <button @click="ipcHandle">Ping</button>
      <button @click="selectSerial">Test Web Serial API</button>
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
}
</style>
