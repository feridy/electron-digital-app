<script lang="ts" setup>
import { useStore } from '../stores';
import { onMounted, onUnmounted, ref } from 'vue';
import { Spin } from 'ant-design-vue';
import { AudioPlayer } from '../player';

const store = useStore();
const text = ref('');
const isLoading = ref(false);

function onSave() {
  if (text.value) {
    isLoading.value = true;

    store.audioPlayer?.downloadAudioFile(text.value, () => {
      isLoading.value = false;
      text.value = '';
    });
  }
}

onMounted(async () => {
  const config = await window.api.getConfigs().catch(() => {
    return {};
  });
  if (!store.audioPlayer) {
    store.setAudioPlayer(new AudioPlayer());
  }

  store.audioPlayer?.initTTSConfig({
    vcn: config.vcn,
    volume: config.volume,
    speed: config.speed,
    pitch: config.pitch
  });
});
onUnmounted(() => {
  store.audioPlayer?.destroy();
  store.setAudioPlayer(null);
});
</script>

<template>
  <div class="generate-audio">
    <h2>语音合成</h2>
    <Spin :spinning="isLoading">
      <div class="page-main">
        <div>
          <p>
            <label><input type="checkbox" id="guli" /></label>
          </p>
          <textarea id="input_text" placeholder="请输入您要合成的文本" v-model="text"></textarea>
        </div>
        <div>
          <button class="audio-ctrl-btn" @click="onSave">立即合成</button>
        </div>
      </div>
    </Spin>
  </div>
</template>

<style lang="scss" scoped>
.generate-audio {
  width: 100%;
  height: 100%;
  padding: 20px;
}
.page-main {
  text-align: center;
  padding: 20px 0;
}
#input_text {
  padding: 8px;
  width: 400px;
  height: 100px;
  border: 1px solid #ddd;
  outline: none;
  font-size: 13px;
  line-height: 1.5;
  color: #fff;
}
button {
  margin-top: 10px;
  width: 100px;
  height: 36px;
  background-color: #187cff;
  border: none;
  border-radius: 3px;
  outline: none;
  color: #fff;
  font-size: 14px;
  cursor: pointer;
}
</style>
