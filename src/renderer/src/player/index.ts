import { enc, HmacSHA256 } from 'crypto-js';
import _ from 'lodash';
import { Base64 } from 'js-base64';
import { MeydaAnalyzer } from 'meyda/dist/esm/meyda-wa';
import { LipSync } from '../lipsync';
import { EventDispatcher } from 'three';
import { Modal } from 'ant-design-vue';

const requestParams = {
  header: {
    app_id: import.meta.env.VITE_APP_TTS_APP_ID,
    status: 2
  },
  parameter: {
    oral: {
      oral_level: 'mid'
    },
    tts: {
      vcn: 'x4_lingxiaoxuan_oral',
      volume: 50,
      speed: 50,
      pitch: 50,
      bgs: 0,
      rhy: 1,
      audio: {
        encoding: 'raw',
        sample_rate: 16000,
        channels: 1,
        bit_depth: 16,
        frame_size: 512
      },
      pybuf: {
        encoding: 'utf8',
        compress: 'raw',
        format: 'plain'
      }
    }
  },
  payload: {
    text: {
      encoding: 'utf8',
      compress: 'raw',
      status: 0,
      seq: 0,
      text: ''
    }
  }
};

export enum AudioPlayerEventKey {
  WSClosed = 'ws:closed',
  WSError = 'ws:error',
  WSMessage = 'ws:message',
  Ready = 'ws:open',
  WSTimeout = 'ws:timeout',
  AudioPlay = 'audio:play',
  AudioStop = 'audio:stop',
  AudioTimeupdate = 'audio:timeupdate'
}

type AudioPlayerEventMap = {
  [AudioPlayerEventKey.WSClosed]: { type: AudioPlayerEventKey.WSClosed };
  [AudioPlayerEventKey.WSError]: { type: AudioPlayerEventKey.WSError; message: string };
  [AudioPlayerEventKey.WSMessage]: {
    type: AudioPlayerEventKey.WSMessage;
    audio: { seq: number; data: Float32Array };
  };
  [AudioPlayerEventKey.Ready]: {
    type: AudioPlayerEventKey.Ready;
  };
  [AudioPlayerEventKey.AudioPlay]: { type: AudioPlayerEventKey.AudioPlay };
  [AudioPlayerEventKey.AudioStop]: { type: AudioPlayerEventKey.AudioStop };
  [AudioPlayerEventKey.AudioTimeupdate]: {
    type: AudioPlayerEventKey.AudioTimeupdate;
    currentTime: number;
  };
  [AudioPlayerEventKey.WSTimeout]: {
    type: AudioPlayerEventKey.WSTimeout;
    endText?: string;
  };
};

const audioSources = new Map<HTMLAudioElement, MediaElementAudioSourceNode>();

export class AudioPlayer extends EventDispatcher<AudioPlayerEventMap> {
  ws?: WebSocket;
  // tts转换回来的音频数据的列表
  audioBufferList: { seq: number; data: Float32Array }[] = [];

  audioContext!: AudioContext;
  /**
   * 音频数据的offset，为了使用一段一段的播放使用
   */
  audioDataOffset = 0;

  bufferSourceNode?: AudioBufferSourceNode;

  analyzer?: MeydaAnalyzer;
  /**
   * 播放状态
   */
  state: 'playing' | 'stop' | 'loading' | 'loaded' = 'stop';

  next = false;

  isDestroy = false;

  lipsync!: LipSync;

  currentTime = 0;

  oldTime = 0;

  isRest = false;

  constructor() {
    super();
    this.audioContext = new AudioContext();

    this.lipsync = new LipSync(this.audioContext, {
      update: () => {
        const now = window.performance.now();
        if (this.oldTime) {
          this.currentTime += now - this.oldTime;
          this.dispatchEvent({
            type: AudioPlayerEventKey.AudioTimeupdate,
            currentTime: this.currentTime
          });
          // console.log(this.currentTime);
        }
        this.oldTime = now;
      }
    });

    (window as any).audioPlayer = this;
  }

  sendWsText(
    text: string,
    isEnd?: boolean,
    options?: {
      onReady?: () => void;
      onmessage?: (fre: { seq: number; data: Float32Array }) => void;
      onfinish?: () => void;
      onerror?: (message: string) => void;
    }
  ) {
    if (!text) return;
    this.isRest = false;
    const url = getWebSocketUrl();
    if (!this.ws) {
      const ws = new WebSocket(url);
      this.ws = ws;
      let timeoutId = -1;

      this.ws.onopen = () => {
        clearTimeout(timeoutId);
        if (this.isRest) return;
        const sendParams = _.cloneDeep(requestParams);
        sendParams.payload.text.text = Base64.encode(text);
        sendParams.payload.text.status = 2;
        this.ws?.send(JSON.stringify(sendParams));
        options?.onReady?.();
        this.dispatchEvent({
          type: AudioPlayerEventKey.Ready
        });
        if (this.audioDataOffset !== 0 && !this.audioBufferList.length) {
          this.state = 'loading';
        }
      };

      this.ws.onmessage = (event) => {
        if (this.isRest) return;
        // 处理相关的音频消息
        const message = event.data;
        const json = JSON.parse(message);
        // tts服务器相关的错误消息
        if (!json.header || json.header.code !== 0) {
          options?.onerror?.(`获取结果失败，请根据code查证问题原因;失败Code：${json.header.code}`);
          return;
        }
        if (json.payload && json.payload.pybuf?.text) {
          const py = Base64.decode(json.payload.pybuf.text)?.split(';');
          const obj: Record<string, number>[] = [];
          py.forEach((item) => {
            const [t, o] = item.split(':');
            if (t && o) {
              const a = {} as any;
              const c = t.split('[')[0];
              a[c] = Number(o);
              obj.push(a);
            }
          });

          // console.log(obj);
        }
        if (json.payload && json.payload.audio) {
          // 获取音频的Buffer数据
          const result = transToAudioData(
            json.payload.audio.audio,
            json.payload.audio.sample_rate,
            48000
          );
          const data = {
            seq: json.payload.audio.seq,
            data: result.output
          };
          this.audioBufferList.push(data);
          if (this.audioDataOffset === 0) {
            if (this.state === 'loading') {
              this.state = 'loaded';
            }
            this.play();
          }
          this.dispatchEvent({
            type: AudioPlayerEventKey.WSMessage,
            audio: data
          });
          options?.onmessage?.(data);
        }
        // 完成了一段话的TTS
        if (json.header.status === 2) {
          // 关闭当前的WS
          this.ws?.close();

          if (this.state === 'loading') {
            this.state = 'loaded';
          }
          this.play();
        }
      };

      this.ws.onerror = (e) => {
        console.log(e);
        options?.onerror?.('出现了异常的错误❌');
        // Modal.error({
        //   title: '提示',
        //   content: '出现了异常的错误❌'
        // });
        this.dispatchEvent({
          type: AudioPlayerEventKey.WSError,
          message: '出现了异常的错误❌'
        });
      };

      this.ws.onclose = () => {
        // 可以开启下一次TTS转换
        this.ws = undefined;

        options?.onfinish?.();
        this.dispatchEvent({
          type: AudioPlayerEventKey.WSClosed
        });

        console.log('closed');
      };

      // 设置5S的超时处理
      timeoutId = setTimeout(() => {
        if (ws?.readyState === WebSocket.CONNECTING) {
          this.ws?.close();
          this.dispatchEvent({
            type: AudioPlayerEventKey.WSTimeout,
            endText: text
          });
          this.ws = undefined;
          console.log('文本转语音失败了');
        }
      }, 5 * 1000) as any;
    }
  }

  downloadAudioFile(text: string, callback?: () => void) {
    if (!text) return;
    const url = getWebSocketUrl();
    if (!this.ws) {
      const rawAudioData: number[] = [];
      this.ws = new WebSocket(url);
      this.ws.onopen = () => {
        const sendParams = _.cloneDeep(requestParams);
        sendParams.payload.text.text = Base64.encode(text);
        sendParams.payload.text.status = 2;
        this.ws?.send(JSON.stringify(sendParams));
      };
      this.ws.onmessage = (event) => {
        // 处理相关的音频消息
        const message = event.data;
        const json = JSON.parse(message);
        // tts服务器相关的错误消息
        if (!json.header || json.header.code !== 0) {
          Modal.error({
            title: '错误',
            content: `获取结果失败，请根据code查证问题原因;失败Code：${json.header.code}`
          });
          return;
        }

        if (json.payload && json.payload.audio) {
          // 获取音频的Buffer数据
          const result = transToAudioData(
            json.payload.audio.audio,
            json.payload.audio.sample_rate,
            48000
          );
          rawAudioData.push(...result.rawAudioData);
        }
        // 完成了一段话的TTS
        if (json.header.status === 2) {
          // 关闭当前的WS
          this.ws?.close();
          if (rawAudioData.length) {
            downloadWAV(new DataView(new Int16Array(rawAudioData).buffer), 16000, 16);

            callback?.();
          }
        }
      };
      this.ws.onclose = () => {
        // 可以开启下一次TTS转换
        this.ws = undefined;
      };
    }
  }

  /**
   * 进行音频数据播放，使用AudioContext播放
   */
  async play() {
    if (this.isRest) return;
    if (
      (this.audioBufferList.length && this.state !== 'playing') ||
      (this.audioBufferList.length && this.next)
    ) {
      if (this.audioContext.state === 'suspended') {
        await this.audioContext.resume();
      }
      const audioData = this.audioBufferList.slice(this.audioDataOffset);
      audioData.sort((a, b) => (a < b ? 1 : 0));
      if (!audioData.length) return;
      this.state = 'playing';
      this.next = false;
      const buffer = concatArrays(audioData.map((item) => item.data));
      const audioBuffer = this.audioContext.createBuffer(1, buffer.length, 48000);
      const nowBuffering = audioBuffer.getChannelData(0);
      if (audioBuffer.copyToChannel) {
        audioBuffer.copyToChannel(new Float32Array(buffer), 0, 0);
      } else {
        for (let i = 0; i < buffer.length; i++) {
          nowBuffering[i] = buffer[i];
        }
      }
      const bufferSourceNode = this.audioContext.createBufferSource();
      this.bufferSourceNode = bufferSourceNode;
      this.bufferSourceNode.buffer = audioBuffer;
      this.bufferSourceNode.connect(this.audioContext.destination);
      this.bufferSourceNode.start();
      this.audioDataOffset = this.audioBufferList.length;
      this.lipsync?.start(this.bufferSourceNode);
      this.bufferSourceNode.onended = () => {
        console.log('当前的流播放完成');
        this.analyzer?.stop();
        this.lipsync.stop();
        // 没有进行播放的状态时
        if (this.state !== 'playing') return;
        // 判断是否还有新的流的数据
        if (this.audioBufferList.length > this.audioDataOffset) {
          this.next = true;
          // 还存在流就要继续播放
          this.play();
          console.log('继续进行流的播放');
        } else {
          this.stop();
          this.next = false;
        }
      };

      this.dispatchEvent({
        type: AudioPlayerEventKey.AudioPlay
      });
    }
  }

  async playAudioEl(audioEl: HTMLAudioElement) {
    if (this.audioContext.state === 'suspended') {
      await this.audioContext.resume();
    }

    let audioSource = audioSources.get(audioEl);
    if (!audioSource) {
      audioSource = this.audioContext.createMediaElementSource(audioEl);
      audioSource.connect(this.audioContext.destination);
      audioSources.set(audioEl, audioSource);
    }

    this.lipsync.start(audioSource);

    this.dispatchEvent({
      type: AudioPlayerEventKey.AudioPlay
    });

    audioEl.onended = async () => {
      this.lipsync.stop();
      audioSource.disconnect();
      this.dispatchEvent({
        type: AudioPlayerEventKey.AudioStop
      });
      await this.audioContext.suspend();
      audioEl.currentTime = 0;
    };
    audioEl.onpause = async () => {
      this.lipsync.stop();
      this.dispatchEvent({
        type: AudioPlayerEventKey.AudioStop
      });
    };

    await audioEl.play();
  }

  async stop() {
    this.next = false;
    this.bufferSourceNode?.stop();
    this.analyzer?.stop();
    this.lipsync?.stop();
    this.dispatchEvent({
      type: AudioPlayerEventKey.AudioStop
    });
    this.state = 'stop';
  }

  async reset() {
    await this.stop();
    this.ws?.close();
    this.ws = undefined;
    this.isRest = true;
    this.audioBufferList = [];
    this.audioDataOffset = 0;
    if (this.bufferSourceNode?.numberOfOutputs) {
      this.bufferSourceNode?.disconnect();
    }
    this.bufferSourceNode = undefined;
    this.audioBufferList.length = 0;
    this.currentTime = 0;
    this.oldTime = 0;
    await this.audioContext.suspend();
  }

  async destroy() {
    this.reset();
    this.ws?.close();
    this.ws = undefined;
    this.isDestroy = true;
    this.audioContext.suspend();
    await this.audioContext.close();
  }
}

/**
 * 获取websocket url
 * 该接口需要后端提供，这里为了方便前端处理
 */
function getWebSocketUrl() {
  // 请求地址根据语种不同变化
  const url = new URL('wss://cbm01.cn-huabei-1.xf-yun.com/v1/private/medd90fec');
  // const u = new URL(url);
  const host = url.host;
  const apiKey = import.meta.env.VITE_APP_TTS_APP_KEY;
  const apiSecret = import.meta.env.VITE_APP_TTS_APP_SECRET;
  const date = new Date().toUTCString();
  const algorithm = 'hmac-sha256';
  const headers = 'host date request-line';
  const signatureOrigin = `host: ${host}\ndate: ${date}\nGET ${url.pathname} HTTP/1.1`;
  const signatureSha = HmacSHA256(signatureOrigin, apiSecret);
  const signature = enc.Base64.stringify(signatureSha);
  const authorizationOrigin = `api_key="${apiKey}", algorithm="${algorithm}", headers="${headers}", signature="${signature}"`;
  const authorization = btoa(authorizationOrigin);
  return `${url.toString()}?authorization=${authorization}&date=${date}&host=${host}`;
}

function transToAudioData(audioDataStr: string, fromRate = 16000, toRate = 16000) {
  const outputS16 = base64ToS16(audioDataStr);
  let output = transS16ToF32(outputS16);
  output = transSamplingRate(output, fromRate, toRate);
  // output = Array.from(output);

  return {
    output,
    rawAudioData: outputS16
  };
}

function base64ToS16(base64AudioData: string) {
  base64AudioData = atob(base64AudioData);
  const outputArray = new Uint8Array(base64AudioData.length);
  for (let i = 0; i < base64AudioData.length; ++i) {
    outputArray[i] = base64AudioData.charCodeAt(i);
  }
  return new Int16Array(new DataView(outputArray.buffer).buffer);
}

function transS16ToF32(input: Int16Array) {
  const tmpData: number[] = [];
  for (let i = 0; i < input.length; i++) {
    const d = input[i] < 0 ? input[i] / 0x8000 : input[i] / 0x7fff;
    tmpData.push(d);
  }
  return new Float32Array(tmpData);
}

function transSamplingRate(data: Float32Array, fromRate = 44100, toRate = 16000) {
  const fitCount = Math.round(data.length * (toRate / fromRate));
  const newData = new Float32Array(fitCount);
  const springFactor = (data.length - 1) / (fitCount - 1);
  newData[0] = data[0];
  for (let i = 1; i < fitCount - 1; i++) {
    const tmp = i * springFactor;
    const before = Number(Math.floor(tmp).toFixed());
    const after = Number(Math.ceil(tmp).toFixed());
    const atPoint = tmp - before;
    newData[i] = data[before] + (data[after] - data[before]) * atPoint;
  }
  newData[fitCount - 1] = data[data.length - 1];
  return newData;
}

function concatArrays(arrays: Float32Array[]): Float32Array {
  const sizes = arrays.reduce(
    (out, next) => {
      out.push((out.at(-1) as number) + next.length);
      return out;
    },
    [0]
  );
  const outArray = new Float32Array(sizes.at(-1) as number);
  arrays.forEach((arr, index) => {
    const place = sizes[index];
    outArray.set(arr, place);
  });
  return outArray;
}

function writeString(data: DataView, offset: number, str: string) {
  for (let i = 0; i < str.length; i++) {
    data.setUint8(offset + i, str.charCodeAt(i));
  }
}

function encodeWAV(
  bytes: DataView,
  sampleRate: number,
  numChannels: number,
  outputSampleBits: number,
  littleEdian = true
) {
  const sampleBits = outputSampleBits;
  const buffer = new ArrayBuffer(44 + bytes.byteLength);
  const data = new DataView(buffer);
  const channelCount = numChannels;
  let offset = 0;
  // 资源交换文件标识符
  writeString(data, offset, 'RIFF');
  offset += 4;
  // 下个地址开始到文件尾总字节数,即文件大小-8
  data.setUint32(offset, 36 + bytes.byteLength, true);
  offset += 4;
  // WAV文件标志
  writeString(data, offset, 'WAVE');
  offset += 4;
  // 波形格式标志
  writeString(data, offset, 'fmt ');
  offset += 4;
  // 过滤字节,一般为 0x10 = 16
  data.setUint32(offset, 16, true);
  offset += 4;
  // 格式类别 (PCM形式采样数据)
  data.setUint16(offset, 1, true);
  offset += 2;
  // 通道数
  data.setUint16(offset, channelCount, true);
  offset += 2;
  // 采样率,每秒样本数,表示每个通道的播放速度
  data.setUint32(offset, sampleRate, true);
  offset += 4;
  // 波形数据传输率 (每秒平均字节数) 单声道×每秒数据位数×每样本数据位/8
  data.setUint32(offset, channelCount * sampleRate * (sampleBits / 8), true);
  offset += 4;
  // 快数据调整数 采样一次占用字节数 单声道×每样本的数据位数/8
  data.setUint16(offset, channelCount * (sampleBits / 8), true);
  offset += 2;
  // 每样本数据位数
  data.setUint16(offset, sampleBits, true);
  offset += 2;
  // 数据标识符
  writeString(data, offset, 'data');
  offset += 4;
  // 采样数据总数,即数据总大小-44
  data.setUint32(offset, bytes.byteLength, true);
  offset += 4;

  // 给wav头增加pcm体
  for (let i = 0; i < bytes.byteLength; ) {
    data.setUint8(offset, bytes.getUint8(i));
    offset++;
    i++;
  }

  return data;
}

export function downloadWAV(audioData: DataView, sampleRate?: number, oututSampleBits?: number) {
  const wavData = encodeWAV(audioData, sampleRate || 44100, 1, oututSampleBits || 16);
  const blob = new Blob([wavData], {
    type: 'audio/wav'
  });
  const defaultName = new Date().getTime();
  const node = document.createElement('a');
  node.href = window.URL.createObjectURL(blob);
  node.download = `${defaultName}.wav`;
  node.click();
  node.remove();
}

export function downloadPCM(audioData: DataView) {
  const blob = new Blob([audioData], {
    type: 'audio/pcm'
  });
  const defaultName = new Date().getTime();
  const node = document.createElement('a');
  node.href = window.URL.createObjectURL(blob);
  node.download = `${defaultName}.pcm`;
  node.click();
  node.remove();
}

function transF32ToS16(input: Float32Array) {
  const tmpData: number[] = [];
  for (let i = 0; i < input.length; i++) {
    const d = input[i] < 0 ? input[i] * 0x8000 : input[i] * 0x7fff;
    tmpData.push(d);
  }
  return new Int16Array(tmpData);
}
