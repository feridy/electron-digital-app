<script setup lang="ts">
import VideoListComponent from '../components/VideoListComponent.vue';
</script>

<template>
  <div class="video-wrapper">
    <VideoListComponent />
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
