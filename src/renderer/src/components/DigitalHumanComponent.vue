<script setup lang="ts">
import { nextTick, onMounted, onUnmounted, ref, watch } from 'vue';
import { useVAD } from '../vad';
import * as THREE from 'three';
import { GLTFLoader, RoomEnvironment } from 'three-stdlib';
import MarkdownComponent from './MarkdownComponent';
// @ts-ignore
import { MicVAD } from '@renderer/vad-web';
// @ts-ignore
import { useStore } from '@renderer/stores';
import { AudioPlayerEventKey } from '../player';
import BScroll from '@better-scroll/core';

let vad: MicVAD | null = null;
const elRef = ref<HTMLDivElement>();
const scrollEl = ref<HTMLDivElement>();
const store = useStore();
const isStartSpeaking = ref(false);
const showAnswer = ref(false);
const commandText = ref('');
const actions: Record<string, THREE.AnimationAction> = {};
const needWeakSpaceTime = 20; //20s后就需要重新唤醒，要重置唤醒状态
let bScroll: BScroll;
let scene: THREE.Scene;
let renderer: THREE.WebGLRenderer;
let mixer: THREE.AnimationMixer;
let handleResize = () => {};
let closeTimeId;
let resetTimeout;

async function initHuman() {
  let clock: THREE.Clock;
  let camera: THREE.PerspectiveCamera;

  // let stats: Stats;
  let mesh: THREE.Mesh;
  const el = elRef.value;
  if (!el) return;

  clock = new THREE.Clock();
  camera = new THREE.PerspectiveCamera(20, window.innerWidth / window.innerHeight, 0.1, 1200);
  camera.position.set(0, 0.02, 2.3);
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

  const gltf = await new GLTFLoader().loadAsync('./scene.glb');
  const model = gltf.scene;

  scene.add(model);

  mixer = new THREE.AnimationMixer(model);

  model.traverseVisible((item) => {
    if ((item as any).isMesh && item.name === 'tou_1') {
      console.log(item);
      mesh = item as THREE.Mesh;
    }
  });

  if (gltf.animations.length) {
    gltf.animations.forEach((item) => {
      actions[item.name] = mixer.clipAction(item);
    });

    console.log(gltf.animations);
  }

  actions['daiji']?.play();

  const environment = RoomEnvironment();

  const pmremGenerator = new THREE.PMREMGenerator(renderer);
  scene.environment = pmremGenerator.fromScene(environment, 0.5).texture;
  scene.environmentIntensity = 0.2;

  el.appendChild(renderer.domElement);

  function renderLoop() {
    const delta = clock.getDelta();
    if (mixer) {
      mixer.update(delta);
    }

    renderer.render(scene, camera);
    const lipsync = store.audioPlayer.lipsync;

    if (lipsync.isWorking && mesh) {
      if (mesh.morphTargetDictionary) {
        const kiss = mesh.morphTargetDictionary?.['blendShape1.kiss'];
        const lips = mesh.morphTargetDictionary?.['blendShape1.lips'];
        const mouth = mesh.morphTargetDictionary?.['blendShape1.mouth'];
        const bizui = mesh.morphTargetDictionary?.['blendShape1.bizui'];
        if (mesh.morphTargetInfluences) {
          mesh.morphTargetInfluences[mouth] = Number.isNaN(lipsync.blendShapes.blendShapeMouth)
            ? 0
            : lipsync.blendShapes.blendShapeMouth;
          mesh.morphTargetInfluences[lips] = Number.isNaN(lipsync.blendShapes.blendShapeLips)
            ? 0
            : lipsync.blendShapes.blendShapeLips;
          mesh.morphTargetInfluences[kiss] = Number.isNaN(lipsync.blendShapes.blendShapeKiss)
            ? 0
            : lipsync.blendShapes.blendShapeKiss;

          mesh.morphTargetInfluences[bizui] = 0.8;
        }
      }
    } else if (!lipsync.isWorking && mesh) {
      if (mesh.morphTargetDictionary) {
        const kiss = mesh.morphTargetDictionary?.['blendShape1.kiss'];
        const lips = mesh.morphTargetDictionary?.['blendShape1.lips'];
        const mouth = mesh.morphTargetDictionary?.['blendShape1.mouth'];
        const bizui = mesh.morphTargetDictionary?.['blendShape1.bizui'];
        if (mesh.morphTargetInfluences) {
          mesh.morphTargetInfluences[mouth] = 0;
          mesh.morphTargetInfluences[lips] = 0;
          mesh.morphTargetInfluences[kiss] = 0;
          if (mesh.morphTargetInfluences[bizui] > 0) {
            mesh.morphTargetInfluences[bizui] -= 0.01;
          } else {
            mesh.morphTargetInfluences[bizui] = 0;
          }
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

function onAudioPay() {}
function onAudioPause() {}

watch(
  () => store.showAiAnswer,
  () => {
    nextTick(() => {
      bScroll?.refresh();
      if (bScroll?.enabled) {
        bScroll?.scrollTo(0, bScroll.maxScrollY, 600);
      }
    });
  }
);

watch(
  () => store.isHandleCompleted,
  (isHandleCompleted) => {
    clearTimeout(closeTimeId);
    // 延时2s，关闭回答的界面
    if (isHandleCompleted) {
      clearTimeout(resetTimeout);
      closeTimeId = setTimeout(() => {
        showAnswer.value = false;
        resetTimeout = setTimeout(() => {
          store.reset();
          (vad as any)?.setWeakState(false);
        }, needWeakSpaceTime * 1000);
      }, 3000);
    }
  }
);

onMounted(async () => {
  try {
    let sendCommandTimeId;
    await initHuman();
    vad = await useVAD(
      () => {
        isStartSpeaking.value = true;
        commandText.value = '';
        showAnswer.value = false;
        clearInterval(sendCommandTimeId);
      },
      (text) => {
        commandText.value = text;
        clearTimeout(resetTimeout);
      },
      () => {
        clearInterval(sendCommandTimeId);
        vad?.pause();
        // 1s后进行问题发送
        sendCommandTimeId = setTimeout(() => {
          store.showAiAnswer = '您的问题正在处理中....';
          // 发送问题到问答平台
          store.sendMicText(commandText.value);
          isStartSpeaking.value = false;
          showAnswer.value = true;
          clearTimeout(closeTimeId);
        }, 1000);
      },
      () => {
        isStartSpeaking.value = false;
      }
    );
    vad.start();
    store.setVad(vad);
    store.humanLoadSuccess();
    (store.audioPlayer as any).addEventListener(AudioPlayerEventKey.AudioPlay, onAudioPay);
    (store.audioPlayer as any).addEventListener(AudioPlayerEventKey.AudioStop, onAudioPause);
  } catch (error) {
    console.log(error);
  }
});

onUnmounted(() => {
  vad?.destroy();
  renderer?.dispose();
  scene?.removeFromParent();
  mixer?.stopAllAction();
  store.reset();
  window.removeEventListener('resize', handleResize);
  (store.audioPlayer as any).removeEventListener(AudioPlayerEventKey.AudioPlay, onAudioPay);
  (store.audioPlayer as any).removeEventListener(AudioPlayerEventKey.AudioStop, onAudioPause);
});
</script>

<template>
  <div class="digital-human">
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
    left: 50%;
    transform: translate(-50%, -50%);
    width: calc(1058 / 1080 * 100vw);
    height: calc(356 / 1080 * 100vw);
    max-width: 1058px;
    max-height: 356px;
    background-image: url('../assets/images/ai-answer-bg.png');
    background-size: cover;
    background-repeat: no-repeat;
    background-position: center;
    padding: 60px 40px 40px 40px;

    &-view {
      width: 100%;
      height: 100%;
      overflow: hidden;
    }

    &-text {
      font-weight: 500;
      font-size: 34px;
      color: #fff9cb;
      line-height: 1.4;
    }
  }
}
</style>
