<script setup lang="ts">
import { RouterView, useRouter } from 'vue-router';
import { onMounted, onUnmounted } from 'vue';
import UpdateComponent from './components/UpdateComponent.vue';
const router = useRouter();
function onKeydown(e: KeyboardEvent) {
  if (e.keyCode === 27) {
    router.replace('/');
  }
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
  <UpdateComponent />
</template>
