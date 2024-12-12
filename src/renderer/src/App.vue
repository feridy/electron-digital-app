<script setup lang="ts">
import { RouterView, useRoute, useRouter } from 'vue-router';
import { onMounted, onUnmounted } from 'vue';
import UpdateComponent from './components/UpdateComponent.vue';
const router = useRouter();
const route = useRoute();
function onKeydown(e: KeyboardEvent) {
  if (e.keyCode === 27) {
    router.replace('/');
  }
}

onMounted(() => {
  window.addEventListener('keydown', onKeydown);
  window.electron.ipcRenderer.on('SPACE_PRESSED', () => {
    console.log('-----SPACE_PRESSED-----');
    if (route.path !== '/') {
      router.replace('/');
    } else {
      router.push('/video');
    }
  });
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
  <UpdateComponent />
</template>
