import { defineStore } from 'pinia';
import { ref } from 'vue';

export const usePageStore = defineStore('pageStore', () => {
  const useRecord = ref(false);
  const showMenu = ref(false);
  const showAudioGuideVideo = ref(true);

  function setRecord(state: boolean) {
    useRecord.value = state;
  }

  return {
    useRecord,
    showMenu,
    showAudioGuideVideo,
    setRecord
  };
});
