<script lang="ts" setup>
import { useStore } from '../stores';
import { onMounted, onUnmounted, ref } from 'vue';
import { Spin, Select } from 'ant-design-vue';
import { AudioPlayer } from '../player';
// import { SelectValue } from 'ant-design-vue/es/select';

const store = useStore();
const text = ref('');
const isLoading = ref(false);
const vcn = ref('');

const vcns = [
  {
    label: '当当',
    value: 'x2_dangdang'
  },
  {
    label: '静怡',
    value: 'x4_putongnvqingnian_talk'
  },
  {
    label: '悦小妮',
    value: 'x4_yuexiaoni_assist'
  },
  {
    label: '小果',
    value: 'x4_xiaoguo'
  },
  {
    label: '聆玉言',
    value: 'x4_lingyuyan'
  },
  {
    label: '聆小岚',
    value: 'x4_lingxiaolan_assist'
  },
  {
    label: '聆小璎-情感 ',
    value: 'x4_lingxiaoying_em_v2',
    audio: ''
  },
  {
    label: '聆小珊',
    value: 'x4_lingxiaoshan_profnews',
    audio: ''
  },
  {
    label: '聆佑佑',
    value: 'x4_lingyouyou',
    audio: ''
  },
  {
    label: '聆小璐',
    value: 'x4_lingxiaolu_en',
    audio: ''
  },
  {
    label: '千雪',
    value: 'x4_qianxue',
    audio: ''
  },
  {
    label: '聆小瑶',
    value: 'x4_lingxiaoyao_comic',
    audio: ''
  },
  {
    label: '聆小璇-助理',
    value: 'x4_lingxiaoxuan_en_v2',
    audio: ''
  },
  {
    label: '聆小璐-情感',
    value: 'x4_lingxiaolu_em_v2',
    audio: ''
  },
  {
    label: '潘婷',
    value: 'x4_panting',
    audio: ''
  },
  {
    label: '一菲',
    value: 'x4_yifei',
    audio: ''
  },
  {
    label: '聆小璇-温柔',
    value: 'x4_lingxiaoxuan_en',
    audio: ''
  },
  {
    label: '聆小璇-闲聊',
    value: 'x4_lingxiaoxuan_chat',
    audio: ''
  },
  {
    label: '小露',
    value: 'x4_yezi',
    audio: ''
  },
  {
    label: '聆小瑜-情感',
    value: 'x4_lingxiaoyu_emo',
    audio: ''
  },
  {
    label: '小婉',
    value: 'x2_xiaowan',
    audio: ''
  },
  {
    label: '聆小瑜-助理',
    value: 'x4_lingxiaoyu_assist',
    audio: ''
  },
  {
    label: '聆小璇',
    value: 'x4_lingxiaoxuan_em_v2',
    audio: ''
  },
  {
    label: '聆小瑶-助理',
    value: 'x4_lingxiaoyao_en',
    audio: ''
  },
  {
    label: '聆小璎',
    value: 'x4_lingxiaoying_en',
    audio: ''
  },
  {
    label: '聆小芸-对话',
    value: 'x4_lingxiaoyun_talk',
    audio: ''
  },
  {
    label: '聆小芸-多情感',
    value: 'x4_lingxiaoyun_talk_emo',
    audio: ''
  },
  {
    label: '聆小瑶-情感',
    value: 'x4_lingxiaoyao_em',
    audio: ''
  }
];

function onSave() {
  if (text.value) {
    isLoading.value = true;

    store.audioPlayer?.downloadAudioFile(text.value, vcn.value, () => {
      isLoading.value = false;
      text.value = '';
    });
  }
}

function onChangeVcn(value: any) {
  store.audioPlayer?.changeVcn(value);
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

  vcn.value = config.vcn;
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
          <Select style="width: 220px" v-model:value="vcn" :options="vcns" @change="onChangeVcn" />
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
