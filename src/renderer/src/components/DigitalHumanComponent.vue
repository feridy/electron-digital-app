<script setup lang="ts">
import { onMounted, onUnmounted } from 'vue';
import { useVAD } from '../vad';
import { MicVAD } from '@renderer/vad-web';

let vad: MicVAD | null = null;

onMounted(async () => {
  try {
    vad = await useVAD();
    vad.start();
  } catch (error) {
    console.log(error);
  }
});

onUnmounted(() => {
  vad?.destroy();
});
</script>

<template>
  <div class="digital-human">
    <div class="human">数字人界面</div>
  </div>
</template>

<style lang="scss" scoped>
.digital-human {
  position: relative;
  max-width: 100%;
  max-height: 100%;
  width: 100vw;
  height: 100vh;
}
</style>
