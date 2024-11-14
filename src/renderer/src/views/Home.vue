<script setup lang="ts">
import DigitalHuman from '../components/DigitalHumanComponent.vue';
</script>

<template>
  <div class="home-wrapper">
    <DigitalHuman />
  </div>
</template>

<style lang="scss" scoped>
.home-wrapper {
  position: relative;
  max-width: 100%;
  max-height: 100%;
  width: 100vw;
  height: 100vh;
  overflow: hidden;
}
</style>
