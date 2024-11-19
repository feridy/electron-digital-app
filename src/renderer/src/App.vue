<script setup lang="ts">
import { RouterView } from 'vue-router';
import { onMounted, onUnmounted } from 'vue';
function onKeydown(e: KeyboardEvent) {
  console.log(e.key);
}

onMounted(() => {
  window.addEventListener('keydown', onKeydown);
});

onUnmounted(() => {
  window.removeEventListener('keydown', onKeydown);
});
</script>

<template>
  <RouterView v-slot="{ Component, route }">
    <Transition
      :enter-active-class="`animate__animated animate__faster ${route.meta.enterActiveClass || 'animate__fadeIn'}`"
      :leave-active-class="`animate__animated animate__faster ${route.meta.leaveActiveClass || 'animate__fadeOut'}`"
      appear
      mode="out-in"
    >
      <component :is="Component" :key="route.path" />
    </Transition>
  </RouterView>
</template>
