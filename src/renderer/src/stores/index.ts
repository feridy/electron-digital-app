import { defineStore } from 'pinia';
import { ref } from 'vue';

export const useTestStore = defineStore('test', () => {
  const count = ref(0);
  return { count };
});
