<script setup lang="ts">
import { nextTick, onMounted, onUnmounted, ref, watch } from 'vue';
import { useVAD } from '../vad';
import * as THREE from 'three';
import { GLTFLoader, RoomEnvironment } from 'three-stdlib';
import MarkdownComponent from './MarkdownComponent';
import { AppstoreOutlined } from '@ant-design/icons-vue';
// @ts-ignore
import { MicVAD } from '@renderer/vad-web';
// @ts-ignore
import { useStore } from '@renderer/stores';
import { AudioPlayer, AudioPlayerEventKey } from '../player';
import BScroll from '@better-scroll/core';
import { useRouter } from 'vue-router';
import { Modal } from 'ant-design-vue';

let vad: MicVAD | null = null;
const router = useRouter();
const elRef = ref<HTMLDivElement>();
const scrollEl = ref<HTMLDivElement>();
const store = useStore();
const isStartSpeaking = ref(false);
const showAnswer = ref(false);
const commandText = ref('');
const isWakeUp = ref(false);
const tipEl = ref<HTMLSpanElement>();
const audioRef = ref<HTMLAudioElement>();
const mountAudioRef = ref<HTMLAudioElement>();
const mountAudioPlayEnd = ref(false);
const actions: Record<string, THREE.AnimationAction> = {};
let bScroll: BScroll;
let scene: THREE.Scene;
let renderer: THREE.WebGLRenderer;
let mixer: THREE.AnimationMixer;
let handleResize = () => {};
const showVideoMenus = ref(false);
const config = ref<any>({});
let closeTimeId;
let resetTimeout;
let showVideoMenuTimeId;

const wekaUpStr = ref<string>('');

async function initHuman(modelPath: string) {
  let clock: THREE.Clock;
  let camera: THREE.PerspectiveCamera;

  // 设置目标帧率
  const targetFPS = 24;
  const frameInterval = 1000 / targetFPS; // 每帧的时间间隔（毫秒）
  let then = Date.now();

  // let stats: Stats;
  let mesh: THREE.Mesh;
  const el = elRef.value;
  if (!el) return;

  clock = new THREE.Clock();
  camera = new THREE.PerspectiveCamera(20, window.innerWidth / window.innerHeight, 0.1, 1200);
  camera.position.set(0, 0.02, 2.1);
  // camera.position.set(0, 0.2, 1);
  scene = new THREE.Scene();

  const hemispLight = new THREE.HemisphereLight(0xffffff, 0x8d8d8d, 1.4);
  const light = new THREE.AmbientLight(0xffffff, 0.2);
  hemispLight.position.set(0, 100, 0);
  scene.add(hemispLight);
  scene.add(light);

  renderer = new THREE.WebGLRenderer({
    antialias: true,
    alpha: true
  });
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setAnimationLoop(renderLoop);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;

  const gltf = await new GLTFLoader().loadAsync(modelPath);
  // console.log(gltf);
  const model = gltf.scene;

  scene.add(model);

  mixer = new THREE.AnimationMixer(model);

  model.traverseVisible((item) => {
    if ((item as any).isMesh && item.name === 'face') {
      // console.log(item);
      mesh = item as THREE.Mesh;
    }
  });

  console.log(model);

  if (gltf.animations.length) {
    gltf.animations.forEach((item) => {
      actions[item.name] = mixer.clipAction(item);
    });

    // console.log(gltf.animations);
  }

  // actions['daiji']?.play();
  // actions['zhaoshou']?.setDuration(4).play();
  console.log(actions);
  playIdle();

  const environment = RoomEnvironment();

  const pmremGenerator = new THREE.PMREMGenerator(renderer);
  scene.environment = pmremGenerator.fromScene(environment, 0.01).texture;
  scene.environmentIntensity = 0.2;

  el.appendChild(renderer.domElement);

  // mixer?.addEventListener('finished', () => {
  //   playIdle();
  // });

  function renderLoop() {
    const now = Date.now();
    const tDelta = now - then;
    const delta = clock.getDelta();
    if (mixer) {
      // 更新时间戳
      then = now - (tDelta % frameInterval);
      mixer.update(delta);
    }

    renderer.render(scene, camera);
    const lipsync = store.audioPlayer?.lipsync;

    if (lipsync && lipsync.isWorking && mesh) {
      if (mesh.morphTargetDictionary) {
        // const kiss = mesh.morphTargetDictionary?.['blendShape1.weixiao'];
        const lips = mesh.morphTargetDictionary?.['blendShape1.lips'];
        const mouth = mesh.morphTargetDictionary?.['blendShape1.mouth'];
        const bizui = mesh.morphTargetDictionary?.['blendShape1.bizui'];
        if (mesh.morphTargetInfluences) {
          // console.log(lipsync.blendShapes);
          mesh.morphTargetInfluences[mouth] = Number.isNaN(lipsync.blendShapes.blendShapeMouth)
            ? 0
            : lipsync.blendShapes.blendShapeMouth;
          mesh.morphTargetInfluences[lips] = Number.isNaN(lipsync.blendShapes.blendShapeLips)
            ? 0
            : lipsync.blendShapes.blendShapeLips;
          // mesh.morphTargetInfluences[kiss] = Number.isNaN(lipsync.blendShapes.blendShapeKiss)
          //   ? 0
          //   : lipsync.blendShapes.blendShapeKiss;

          mesh.morphTargetInfluences[bizui] = 0.5;
        }
      }
    } else if (!lipsync?.isWorking && mesh) {
      if (mesh.morphTargetDictionary) {
        const kiss = mesh.morphTargetDictionary?.['blendShape1.weixiao'];
        const lips = mesh.morphTargetDictionary?.['blendShape1.lips'];
        const mouth = mesh.morphTargetDictionary?.['blendShape1.mouth'];
        const bizui = mesh.morphTargetDictionary?.['blendShape1.bizui'];
        if (mesh.morphTargetInfluences) {
          mesh.morphTargetInfluences[mouth] = Math.max(mesh.morphTargetInfluences[mouth] - 0.01, 0);
          mesh.morphTargetInfluences[lips] = Math.max(mesh.morphTargetInfluences[lips] - 0.01, 0);
          mesh.morphTargetInfluences[kiss] = Math.max(mesh.morphTargetInfluences[kiss] - 0.01, 0);
          mesh.morphTargetInfluences[bizui] = Math.max(mesh.morphTargetInfluences[bizui] - 0.01, 0);
        }
      }
    }
  }

  handleResize = () => {
    setTimeout(() => {
      renderer.setSize(window.innerWidth, window.innerHeight);
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
    }, 10);
  };

  window.addEventListener('resize', handleResize);
}

function playZhaoShou() {
  console.log(actions);
  scene?.traverseVisible((item) => {
    if (item.name === 'arm_hs') {
      item.renderOrder = 10;
    }

    if (item.name === 'arm_s_hs') {
      item.renderOrder = 10;
      // item.visible = false;
      // console.log(item);
    }
  });
  // mixer?.stopAllAction();
  for (const key in actions) {
    actions[key].stop();
  }
  actions['zhaoshou']?.setLoop(THREE.LoopOnce, 1).play();
  setTimeout(() => {
    playIdle();
  }, 3400);
}

function playShouHua() {
  for (const key in actions) {
    actions[key].stop();
  }
  actions['shuohua']?.fadeIn(0).play();
}

function playShenzuoShou() {
  for (const key in actions) {
    actions[key].stop();
  }
  actions['shenzuoshou'].setDuration(8).setLoop(THREE.LoopOnce, 1)?.play();
}

function playDianTou() {
  for (const key in actions) {
    actions[key].stop();
  }
  actions['diantou']?.setLoop(THREE.LoopOnce, 1).fadeIn(0).play();
}

function playIdle() {
  for (const key in actions) {
    actions[key].stop();
  }
  actions['daiji']?.fadeIn(0).play();
}

const timeIds: number[] = [];

function onAudioPay() {
  // vad?.start();
  // playShouHua();
  if (showAnswer.value) {
    if (timeIds.length === 0) {
      playShenzuoShou();
      const id = window.setTimeout(() => {
        playShouHua();
      }, 7500) as number;
      timeIds.push(id);
    }
  }
}

function onAudioPause() {
  // timeIds.forEach((item) => window.clearTimeout(item));
  // timeIds.length = 0;
  // playIdle();
}

function onKeydown(e: KeyboardEvent) {
  // 按空格就进行切换
  if (e.keyCode === 32) {
    // router.push('/video');
  }
  if (e.keyCode === 71 && import.meta.env.DEV) {
    router.push('/generate');
  }
}

async function onDeviceChange() {
  const devices = await window.navigator.mediaDevices.enumerateDevices();
  const mic = devices.find((device) => device.kind === 'audioinput');
  if (mic || (!mic && vad)) {
    window.location.reload();
  }
}

watch(
  () => showVideoMenus.value,
  (val) => {
    if (val) {
      clearTimeout(showVideoMenuTimeId);
      showVideoMenuTimeId = setTimeout(() => {
        showVideoMenus.value = false;
      }, 2000);
    }
  }
);

watch(
  () => store.showAiAnswer,
  () => {
    nextTick(() => {
      bScroll?.refresh();
      if (bScroll?.enabled) {
        // console.log(bScroll);
        bScroll?.scrollTo(0, bScroll.maxScrollY, 600);
      }
    });
  }
);

watch(
  () => store.isHandleCompleted,
  (isHandleCompleted) => {
    // 延时2s，关闭回答的界面
    if (isHandleCompleted) {
      clearTimeout(closeTimeId);
      timeIds.forEach((item) => window.clearTimeout(item));
      timeIds.length = 0;
      playIdle();
      closeTimeId = setTimeout(() => {
        showAnswer.value = false;
      }, 3000);
    }
  }
);

watch(isWakeUp, (val) => {
  if (val) {
    nextTick(() => {
      if (audioRef.value) {
        setTimeout(() => {
          store.audioPlayer?.playAudioEl(audioRef.value!);
          playZhaoShou();
          setTimeout(() => {
            vad?.start();
          }, 500);
        }, 30);
      }
    });
  }
});

onMounted(async () => {
  console.log(`-------------进入到了AI数字人页面--------------`);
  window.addEventListener('keydown', onKeydown);
  window.navigator.mediaDevices.addEventListener('devicechange', onDeviceChange);
  let sendCommandTimeId;
  let count = 0;
  let idle = 0;
  try {
    const audioPlayer = new AudioPlayer();
    store.setAudioPlayer(audioPlayer);
    await initHuman('./gxszr.glb');
    vad = await useVAD(
      () => {
        isStartSpeaking.value = true;
        commandText.value = '';
        showAnswer.value = false;
        clearInterval(sendCommandTimeId);
        console.log('----有声音输入进来了----');
        // 进行声音打断
        // store.handleInterrupt();
      },
      (text) => {
        commandText.value = text;
        count = 0;
        console.log('--------ARS语音转换TXT更新-------');
      },
      () => {
        clearInterval(sendCommandTimeId);
        vad?.pause();
        // 1s后进行问题发送
        sendCommandTimeId = setTimeout(() => {
          store.showAiAnswer = '您的问题正在处理中....';
          // 发送问题到问答平台
          if (commandText.value) {
            store.sendMicText(commandText.value);
            isStartSpeaking.value = false;
            showAnswer.value = true;
          } else {
            vad?.start();
            isStartSpeaking.value = false;
          }
          clearTimeout(closeTimeId);
        }, 1000);
        console.log('---------完成了一段语音的输入-----------');
      },
      () => {
        isStartSpeaking.value = false;
        console.log('---------语音输入太短了------------');
        // mountAudioRef.value?.play();
      },
      () => {
        console.log('--------唤醒成功后的回调执行----------');
        count = 0;
        isWakeUp.value = true;
        store.audioPlayer?.stop();
      },
      () => {
        console.log('--------用声音输入进来了----------');
        // mountAudioRef.value?.pause();
      }
    );
    vad.start();
    store.setVad(vad);
    store.humanLoadSuccess();
    (store.audioPlayer as any).addEventListener(AudioPlayerEventKey.AudioPlay, onAudioPay);
    (store.audioPlayer as any).addEventListener(AudioPlayerEventKey.AudioStop, onAudioPause);
    config.value = await window.api.getConfigs().catch(() => {
      return {};
    });

    wekaUpStr.value = (config.value.wakeUpStr || import.meta.env.VITE_APP_V_WEEK_STR)
      .split('|')
      .map((item) => `“${item}”`)
      .join('、');
    audioPlayer.initTTSConfig({
      vcn: config.value.vcn,
      volume: config.value.volume,
      speed: config.value.speed,
      pitch: config.value.pitch
    });

    setTimeout(() => {
      store.audioPlayer?.playAudioEl(mountAudioRef.value!);
      setTimeout(() => {
        // playZhaoShou();
        vad?.start();
      }, 500);
    }, 30);
  } catch (error: any) {
    // console.log(error.message);
    Modal.error({
      title: '错误',
      content: error?.message
    });
  }
  resetTimeout = setInterval(() => {
    // idle时没有人提问时等待3分钟切换的视频播放页面
    if (!isWakeUp.value) {
      if (idle >= (config.value.idleDuration || 180)) {
        console.log(idle);
        router.push('/video');
      }
      idle += 1;
    } else {
      idle = 0;
    }

    if (count >= (config.value.needWeakSpaceTime || 20)) {
      count = 0;
      if (
        !showAnswer.value &&
        !isStartSpeaking.value &&
        !store.isHandling &&
        (vad as any)?.getWeakState()
      ) {
        console.log('--------需要重新进行唤醒--------');
        store.reset();
        (vad as any)?.setWeakState(false);
        isWakeUp.value = false;
      }
      return;
    }

    count += 1;
  }, 1000);
  const showAnswerEl = scrollEl.value;
  if (showAnswerEl) {
    bScroll = new BScroll(showAnswerEl, {
      scrollY: true
    });
  }
});

onUnmounted(() => {
  window.removeEventListener('keydown', onKeydown);
  window.navigator.mediaDevices.removeEventListener('devicechange', onDeviceChange);
  vad?.destroy();
  renderer?.dispose();
  scene?.removeFromParent();
  mixer?.stopAllAction();
  store.reset();
  clearInterval(resetTimeout);
  (store.audioPlayer as any).removeEventListener(AudioPlayerEventKey.AudioPlay, onAudioPay);
  (store.audioPlayer as any).removeEventListener(AudioPlayerEventKey.AudioStop, onAudioPause);
  store.audioPlayer?.destroy();
  store.setAudioPlayer(null);
  window.removeEventListener('resize', handleResize);
  bScroll?.destroy();
});
</script>

<template>
  <div class="digital-human" @mousemove="showVideoMenus = true">
    <div class="human" ref="elRef"></div>
    <Transition
      enter-active-class="animate__animated animate__fadeIn animate__faster"
      leave-active-class="animate__animated animate__fadeOut animate__faster"
    >
      <div class="vad-wrapper" v-if="isStartSpeaking">
        <div class="vad-text">{{ commandText }}</div>
      </div>
    </Transition>

    <Transition
      enter-active-class="animate__animated animate__fadeIn animate__faster"
      leave-active-class="animate__animated animate__fadeOut animate__faster"
    >
      <div class="ai-answer" v-show="showAnswer">
        <div class="ai-answer-view" ref="scrollEl">
          <div class="ai-answer-text">
            <MarkdownComponent :content="store.showAiAnswer" />
          </div>
        </div>
      </div>
    </Transition>
    <Transition
      enter-active-class="animate__animated animate__fadeIn animate__faster"
      leave-active-class="animate__animated animate__fadeOut animate__faster"
    >
      <div class="will-wakeup-tip" v-if="!isWakeUp && wekaUpStr">
        <span ref="tipEl">{{ `请说${wekaUpStr}，来唤醒我，为您解答` }}</span>
      </div>
    </Transition>
    <audio src="./weakup_audio.wav" style="display: none" ref="audioRef" v-if="isWakeUp" />
    <audio
      src="./start_audio.wav"
      style="display: none"
      ref="mountAudioRef"
      @pause="() => (mountAudioPlayEnd = true)"
      @ended="
        () => {
          mountAudioPlayEnd = true;
          // isWakeUp = true;
        }
      "
    />
    <div class="show-video-list" @click="router.push('/video')" v-if="showVideoMenus">
      <AppstoreOutlined />
    </div>
  </div>
</template>

<style lang="scss" scoped>
.digital-human {
  position: relative;
  max-width: 100%;
  max-height: 100%;
  width: 100vw;
  height: 100vh;

  .human {
    width: 100%;
    height: 100%;
  }

  .vad {
    &-wrapper {
      position: absolute;
      top: 50%;
      left: 50%;
      width: 1080px;
      height: 356px;
      transform: translate(-50%, -50%);
      background-image: url('../assets/images/speaking-bg.png');
      background-size: cover;
      background-repeat: no-repeat;
      background-position: center;
      z-index: 100;
      font-family: 'HEAVY';
    }

    &-text {
      display: flex;
      position: absolute;
      bottom: 0;
      left: 0;
      width: 100%;
      height: 210px;
      padding: 0 20px;
      justify-content: center;
      align-items: center;
      white-space: wrap;
      font-size: 34px;
      line-height: 1.4;
      font-weight: 600;
      color: var(--command-text-color);
    }
  }

  .ai-answer {
    position: absolute;
    top: 50%;
    right: 20px;
    transform: translate(0, -50%);
    width: 30%;
    height: 50%;
    /* display: flex;
    flex-flow: column;
    align-items: center;
    justify-content: center; */

    &-view {
      display: flex;
      align-items: center;
      /* justify-content: flex-end; */
      width: 100%;
      height: 100%;
      overflow: hidden;
    }

    &-text {
      font-weight: 500;
      font-size: 36px;
      color: #fff9cb;
      line-height: 1.4;
      text-align: justify;
      font-family: 'HEAVY';
      /* ::v-deep(p) {
        text-indent: 2em;
      } */
      /* writing-mode: vertical-rl;
      letter-spacing: 2px; */
    }
  }
}
.show-video-list {
  position: absolute;
  top: 0;
  right: 0;
  width: 80px;
  height: 80px;
  color: #fff;
  font-size: 50px;
  display: flex;
  justify-content: center;
  align-items: center;
  cursor: pointer;
}

.will-wakeup-tip {
  position: absolute;
  top: 50%;
  left: 40px;
  transform: translate(0, -50%);
  display: flex;
  justify-content: center;
  align-items: center;
  font-weight: 600;
  color: #fff9cb;
  flex-wrap: wrap;
  padding: 40px 0;
  max-height: 100vh;
  > span {
    writing-mode: vertical-lr;
    letter-spacing: 4px;
    font-size: 56px;
    font-weight: 600;
    font-family: 'HEAVY';
    /* text-align: center; */
  }
}
</style>
