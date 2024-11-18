<script setup lang="ts">
// Import Swiper Vue.js components
import { Swiper, SwiperSlide } from 'swiper/vue';
import type { Swiper as SwiperClass } from 'swiper';
import { Parallax, Controller, Autoplay } from 'swiper/modules';
import { CloseOutlined, ArrowLeftOutlined } from '@ant-design/icons-vue';
// Import Swiper styles
import 'swiper/css';
import { ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import videojs from 'video.js';
import 'video.js/dist/video-js.css';
const controlledPrevSwiper = ref<SwiperClass>();
const manSwiper = ref<SwiperClass>();
const controlledNextSwiper = ref<SwiperClass>();
const videoPlayer = ref<HTMLDivElement>();
const router = useRouter();
const playVideo = ref(false);
const showBack = ref(false);
let player;
let timeId;

function onPlayVideo(src: string) {
  if (!player) {
    player = videojs(videoPlayer.value!, {
      autoplay: true,
      loop: true,
      controls: true
    });
  }
  player.src(src);
  player.play();

  playVideo.value = true;
}

function onCloseVideo() {
  player.pause();
  playVideo.value = false;
}

watch(
  () => showBack.value,
  (val) => {
    if (val) {
      clearTimeout(timeId);
      setTimeout(() => {
        showBack.value = false;
      }, 2000);
    }
  }
);
</script>

<template>
  <div class="video-list" @mousemove="showBack = true">
    <div class="title"></div>
    <Swiper
      :speed="600"
      loop
      parallax
      :allowTouchMove="false"
      class="triple-slider-prev"
      :modules="[Parallax, Controller]"
      @swiper="
        (e) => {
          controlledPrevSwiper = e;
        }
      "
      @click="
        () => {
          manSwiper?.slidePrev();
        }
      "
    >
      <SwiperSlide>
        <img src="https://triple-slider.uiinitiative.com/images/suicide-squad.jpg" alt="" />
        <div class="video-title">红四军特务连</div>
      </SwiperSlide>
      <SwiperSlide>
        <img src="https://triple-slider.uiinitiative.com/images/thor-ragnarok.jpg" alt="" />
        <div class="video-title">红四军特务连</div>
      </SwiperSlide>
      <SwiperSlide>
        <img
          src="https://triple-slider.uiinitiative.com/images/guardians-of-the-galaxy.jpg"
          alt=""
        />
        <div class="video-title">红四军特务连</div>
      </SwiperSlide>
      <SwiperSlide>
        <img src="https://triple-slider.uiinitiative.com/images/justice-league.jpg" alt="" />
        <div class="video-title">红四军特务连</div>
      </SwiperSlide>
      <SwiperSlide>
        <img src="https://triple-slider.uiinitiative.com/images/spider-man.jpg" alt="" />
        <div class="video-title">红四军特务连</div>
      </SwiperSlide>
    </Swiper>
    <Swiper
      :speed="600"
      loop
      parallax
      grabCursor
      autoplay
      class="triple-slider-main"
      :modules="[Parallax, Controller, Autoplay]"
      :controller="{
        control:
          controlledPrevSwiper && controlledNextSwiper
            ? [controlledPrevSwiper, controlledNextSwiper]
            : null
      }"
      @destroy="
        () => {
          controlledPrevSwiper?.destroy();
          controlledNextSwiper?.destroy();
        }
      "
      @swiper="
        (e) => {
          manSwiper = e;
        }
      "
    >
      <SwiperSlide @click="onPlayVideo('http://vjs.zencdn.net/v/oceans.mp4')">
        <img src="https://triple-slider.uiinitiative.com/images/thor-ragnarok.jpg" alt="" />
        <div class="video-title">红四军特务连</div>
      </SwiperSlide>
      <SwiperSlide @click="onPlayVideo('http://vjs.zencdn.net/v/oceans.mp4')">
        <img
          src="https://triple-slider.uiinitiative.com/images/guardians-of-the-galaxy.jpg"
          alt=""
        />
        <div class="video-title">红四军特务连</div>
      </SwiperSlide>
      <SwiperSlide @click="onPlayVideo('http://vjs.zencdn.net/v/oceans.mp4')">
        <img src="https://triple-slider.uiinitiative.com/images/justice-league.jpg" alt="" />
        <div class="video-title">红四军特务连</div>
      </SwiperSlide>
      <SwiperSlide @click="onPlayVideo('http://vjs.zencdn.net/v/oceans.mp4')">
        <img src="https://triple-slider.uiinitiative.com/images/spider-man.jpg" alt="" />
        <div class="video-title">红四军特务连</div>
      </SwiperSlide>
      <SwiperSlide @click="onPlayVideo('http://vjs.zencdn.net/v/oceans.mp4')">
        <img src="https://triple-slider.uiinitiative.com/images/suicide-squad.jpg" alt="" />
        <div class="video-title">红四军特务连</div>
      </SwiperSlide>
    </Swiper>
    <Swiper
      :speed="600"
      loop
      parallax
      :allowTouchMove="false"
      class="triple-slider-next"
      :modules="[Parallax, Controller]"
      @swiper="
        (e) => {
          controlledNextSwiper = e;
        }
      "
      @click="
        () => {
          manSwiper?.slideNext();
        }
      "
    >
      <SwiperSlide>
        <img
          src="https://triple-slider.uiinitiative.com/images/guardians-of-the-galaxy.jpg"
          alt=""
        />
        <div class="video-title">红四军特务连</div>
      </SwiperSlide>
      <SwiperSlide>
        <img src="https://triple-slider.uiinitiative.com/images/justice-league.jpg" alt="" />
        <div class="video-title">红四军特务连</div>
      </SwiperSlide>
      <SwiperSlide>
        <img src="https://triple-slider.uiinitiative.com/images/spider-man.jpg" alt="" />
        <div class="video-title">红四军特务连</div>
      </SwiperSlide>
      <SwiperSlide>
        <img src="https://triple-slider.uiinitiative.com/images/suicide-squad.jpg" alt="" />
        <div class="video-title">红四军特务连</div>
      </SwiperSlide>
      <SwiperSlide>
        <img src="https://triple-slider.uiinitiative.com/images/thor-ragnarok.jpg" alt="" />
        <div class="video-title">红四军特务连</div>
      </SwiperSlide>
    </Swiper>
    <div class="video-wrapper" v-show="playVideo">
      <video
        class="video video-js"
        ref="videoPlayer"
        controlsList="nodownload"
        playsinline
        webkit-playsinline
      />
      <div class="close-button" @click="onCloseVideo" v-if="showBack">
        <CloseOutlined />
      </div>
    </div>

    <div class="back-button" @click="router.push('/')" v-if="showBack">
      <ArrowLeftOutlined />
    </div>
  </div>
</template>

<style lang="scss" scoped>
.video-list {
  width: 100vw;
  height: 100vh;
  position: relative;
  overflow: hidden;
  perspective: 1200px;
  display: flex;
  justify-content: center;
  align-items: center;
  .title {
    position: absolute;
    top: 40px;
    left: 50%;
    transform: translate(-50%, 0);
    width: 491px;
    height: 129px;
    background-image: url('../assets/images/video_title.png');
    background-size: cover;
    background-repeat: no-repeat;
    background-position: center;
  }
  .swiper {
    width: 90%;
    max-width: 1400px;
    height: 700px;
    border-radius: 8px;
    overflow: hidden;
    img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }
  }

  .triple-slider-prev {
    opacity: 1;
    position: absolute;
    top: 50%;
    user-select: none;
    cursor: pointer;
    right: 50%;
    transform: translateY(-50%) scale(0.75) rotateY(10deg);
    &::before {
      position: absolute;
      inset: 0;
      content: '';
      pointer-events: none;
      z-index: 9;
      background-color: rgba(0, 0, 0, 0.6);
    }
  }
  .triple-slider-main {
    position: relative;
    z-index: 10;
    box-shadow: 0 0 30px #00000080;
  }
  .triple-slider-next {
    left: 50%;
    transform: translateY(-50%) scale(0.75) rotateY(-10deg);
    opacity: 1;
    position: absolute;
    top: 50%;
    user-select: none;
    cursor: pointer;
    &::before {
      position: absolute;
      inset: 0;
      content: '';
      pointer-events: none;
      z-index: 9;
      background-color: rgba(0, 0, 0, 0.6);
    }
  }

  .video-title {
    position: absolute;
    position: absolute;
    bottom: 32px;
    left: 50%;
    width: 320px;
    margin-left: -160px;
    font-size: 28px;
    text-align: center;
    color: #fff;
    font-weight: 600;
    text-shadow: 1px 1px 1px #000;
  }

  .video-wrapper {
    position: absolute;
    inset: 0;
    width: 100vw;
    height: 100vh;
    object-fit: fill;
    z-index: 9999;
    .video {
      width: 100%;
      height: 100%;
      object-fit: fill;
      video {
        object-fit: fill !important;
      }
    }
  }

  .back-button {
    position: absolute;
    display: flex;
    justify-content: center;
    align-items: center;
    top: 0;
    left: 0;
    width: 80px;
    height: 80px;
    font-size: 50px;
    color: #fff;
    z-index: 9;
    cursor: pointer;
  }

  .close-button {
    position: absolute;
    display: flex;
    justify-content: center;
    align-items: center;
    top: 0px;
    right: 0px;
    width: 80px;
    height: 80px;
    font-size: 50px;
    cursor: pointer;
    color: #fff;
    z-index: 9;
  }
}
</style>
