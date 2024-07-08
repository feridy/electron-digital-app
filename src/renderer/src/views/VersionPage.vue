<script setup lang="ts">
import Versions from '@renderer/components/Versions.vue';
import { useRouter } from 'vue-router';
const router = useRouter();

function onBackClick() {
  router.back();
}
</script>

<template>
  <div class="version-wrapper">
    <div class="version-button" @click="onBackClick">Back</div>
    <Versions />
  </div>
</template>

<style lang="scss" scoped>
.version {
  &-wrapper {
    display: flex;
    justify-content: center;
    align-items: center;
    width: 100vw;
    height: 100vh;
  }
  &-button {
    cursor: pointer;
  }
}
</style>
