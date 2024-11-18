import { MicVAD, utils } from '../vad-web';
import { enc, HmacSHA256 } from 'crypto-js';
// import { downloadWAV } from './audioPlayer';
import { message } from 'ant-design-vue';

export async function useVAD(
  onStart?: () => void,
  onUpdate?: (resultText: string) => void,
  onEnd?: () => void,
  onVADMisfire?: () => void,
  onWeakUp?: () => void
) {
  if (!window.navigator.mediaDevices) {
    throw new Error('MediaDevices is not supported');
  }
  const stream = await window.navigator.mediaDevices.getUserMedia({
    audio: {
      channelCount: 1,
      echoCancellation: true,
      autoGainControl: true,
      noiseSuppression: true
    }
  });
  let resultText = '';
  let resultTextTemp = '';
  let iatWS: WebSocket | null = null;
  let isSpeaking = false;
  const maxRecordingTime = 20 * 1000;
  const preSpeechPadFrames = 2;
  const minSpeechFrames = 3;
  // 统计时间，一次最多能进行60秒的录音
  let speechStartTime = 0;
  let timerId;
  let startWs = false;

  /**
   * 新增唤醒功能，主要在一段音频结束的时候进行语音转文字，然后进行文本内容配置验证关键字的权重。
   */
  const STATUS_RECORD = {
    isVW: false // 是否已经唤醒
  };

  const micVAD = await MicVAD.new({
    stream,
    submitUserSpeechOnPause: true,
    positiveSpeechThreshold: 0.92,
    negativeSpeechThreshold: 0.1,
    minSpeechFrames,
    preSpeechPadFrames,
    // 有声音输入时触发的方法
    onSpeechStart() {
      console.log('VAD，检测到了声音的输入');
      isSpeaking = true;
      clearInterval(timerId);
      speechStartTime = 0;
      // 讲话的开始时间记录
      timerId = setInterval(() => {
        speechStartTime += 1;
        if (!STATUS_RECORD.isVW && speechStartTime >= 3) {
          clearInterval(timerId);
          micVAD.pause();
          return;
        }
        if (speechStartTime >= maxRecordingTime) {
          clearInterval(timerId);
          micVAD.pause();
        }
      }, 1000);

      if (STATUS_RECORD.isVW) {
        createWS();
      }

      startWs = false;
    },
    // 每帧触发的事件
    onFrameProcessed(_probabilities, frame, audioBuffer) {
      console.log(frame.length);

      if (isSpeaking) {
        if (
          (audioBuffer?.length || 0) >= minSpeechFrames &&
          iatWS?.readyState === WebSocket.OPEN &&
          STATUS_RECORD.isVW
        ) {
          // 初始的讲话功能，进行实时显示讲话的内容
          if (audioBuffer && !startWs) {
            const audioData = concatArrays(audioBuffer.map((item) => item.frame));
            const buffer = encodePCM(audioData, 16).buffer;
            const pcm = utils.arrayBufferToBase64(buffer);
            iatWS?.send(
              JSON.stringify({
                data: {
                  status: 1,
                  format: 'audio/L16;rate=16000',
                  encoding: 'raw',
                  audio: pcm
                }
              })
            );
            startWs = true;
          } else {
            const buffer = encodePCM(frame, 16).buffer;
            const pcm = utils.arrayBufferToBase64(buffer);
            iatWS?.send(
              JSON.stringify({
                data: {
                  status: 1,
                  format: 'audio/L16;rate=16000',
                  encoding: 'raw',
                  audio: pcm
                }
              })
            );
          }
        }
      }
    },
    // 输入的帧数少于最小帧时，无效的录音处理
    onVADMisfire() {
      isSpeaking = false;
      console.log('无效的声音输入');
      clearInterval(timerId);
      micVAD.start();
      onVADMisfire?.();
      iatWS?.close();
    },
    // 一段话说完后的状态
    onSpeechEnd(audioData) {
      console.log('完成了一段音频的录音');
      isSpeaking = false;
      micVAD.start();
      clearInterval(timerId);
      // 没有唤醒前，检查唤醒
      if (!STATUS_RECORD.isVW) {
        if (speechStartTime > 5) return;
        const buffer = encodePCM(audioData, 16).buffer;
        const pcm = utils.arrayBufferToBase64(buffer);
        createWS();
        iatWS!.onopen = () => {
          clearTimeout(wsTimeOutId);
          hasMessage = false;
          clearTimeout(timeout);
          timeout = setTimeout(() => {
            if (!hasMessage) {
              iatWS?.close();
              message.error('语音输入失败了，您可以在次提问试试。');
              console.log('语音转文本超时了');
            }
          }, 10000);
          const params = {
            common: {
              app_id: import.meta.env.VITE_APP_ARS_APP_ID
            },
            business: {
              language: 'zh_cn',
              domain: 'iat',
              accent: 'mandarin',
              vad_eos: 5000,
              dwa: 'wpgs'
              // ptt: 0
            },
            data: {
              status: 2,
              format: 'audio/L16;rate=16000',
              encoding: 'raw',
              audio: pcm
            }
          };
          iatWS?.send(JSON.stringify(params));
          if (STATUS_RECORD.isVW) {
            onStart?.();
          }
        };
        return;
      }

      // 最后一次进行一次校准，结束时进行WS状态的改变，将整个录音文件进行转化，唤醒后，最后一次进行语音状态修改
      if (iatWS?.readyState === WebSocket.OPEN) {
        const buffer = encodePCM(audioData, 16).buffer;
        const pcm = utils.arrayBufferToBase64(buffer);

        iatWS?.send(
          JSON.stringify({
            data: {
              status: 2,
              format: 'audio/L16;rate=16000',
              encoding: 'raw'
              // audio: pcm
            }
          })
        );
      }

      // 如果iatWS还在链接中时，还是保存正在播放的状态
      if (iatWS?.readyState === WebSocket.CONNECTING) {
        return;
      }
    }
  });

  (micVAD as any).setWeakState = (state: boolean) => {
    STATUS_RECORD.isVW = state;
  };
  (micVAD as any).getWeakState = () => STATUS_RECORD.isVW;

  function renderResult(resultData: string) {
    // 识别结束
    const jsonData = JSON.parse(resultData);
    if (jsonData.data && jsonData.data.result) {
      const data = jsonData.data.result;
      let str = '';
      const ws = data.ws;
      for (let i = 0; i < ws.length; i++) {
        str = str + ws[i].cw[0].w;
      }
      // 开启wpgs会有此字段(前提：在控制台开通动态修正功能)
      // 取值为 "apd"时表示该片结果是追加到前面的最终结果；取值为"rpl" 时表示替换前面的部分结果，替换范围为rg字段
      if (data.pgs) {
        if (data.pgs === 'apd') {
          // 将resultTextTemp同步给resultText
          resultText = resultTextTemp;
        }
        // 将结果存储在resultTextTemp中
        resultTextTemp = resultText + str;
      } else {
        resultText = resultText + str;
      }
      onUpdate?.(resultTextTemp || resultText || '');
      console.log(resultTextTemp || resultText || '');
    }
    if (jsonData.code === 0 && jsonData.data.status === 2) {
      iatWS?.close();
      micVAD.pause();
      setTimeout(() => {
        onEnd?.();
      }, 0);
    }
    if (jsonData.code !== 0) {
      onEnd?.();
      iatWS?.close();
      console.error(jsonData);
    }
  }
  function checkVWState(message: string) {
    // 识别结束
    const jsonData = JSON.parse(message);
    if (jsonData.data && jsonData.data.result) {
      const data = jsonData.data.result;
      let str = '';
      const ws = data.ws;
      for (let i = 0; i < ws.length; i++) {
        str = str + ws[i].cw[0].w;
      }
      // 开启wpgs会有此字段(前提：在控制台开通动态修正功能)
      // 取值为 "apd"时表示该片结果是追加到前面的最终结果；取值为"rpl" 时表示替换前面的部分结果，替换范围为rg字段
      if (data.pgs) {
        if (data.pgs === 'apd') {
          // 将resultTextTemp同步给resultText
          resultText = resultTextTemp;
        }
        // 将结果存储在resultTextTemp中
        resultTextTemp = resultText + str;
      } else {
        resultText = resultText + str;
      }

      // 进行唤醒词匹配
      if (resultTextTemp && similar(resultTextTemp, import.meta.env.VITE_APP_V_WEEK_STR) > 98) {
        console.log('唤醒成功');
        iatWS?.close();
        STATUS_RECORD.isVW = true;
        onWeakUp?.();
        return;
      }
      console.log(resultTextTemp || resultText || '');
    }
    if (jsonData.code === 0 && jsonData.data.status === 2) {
      iatWS?.close();
    }
    if (jsonData.code !== 0) {
      iatWS?.close();
      console.error(jsonData);
    }
  }
  let wsTimeOutId = -1;
  let hasMessage = false;
  let timeout;
  function onOpen() {
    clearTimeout(wsTimeOutId);
    hasMessage = false;
    clearTimeout(timeout);
    timeout = setTimeout(() => {
      if (!hasMessage) {
        iatWS?.close();
        message.error('语音输入失败了，您可以在次提问试试。');
        console.log('语音转文本超时了');
      }
    }, 10000);
    const params = {
      common: {
        app_id: import.meta.env.VITE_APP_ARS_APP_ID
      },
      business: {
        language: 'zh_cn',
        domain: 'iat',
        accent: 'mandarin',
        vad_eos: 5000,
        dwa: 'wpgs'
        // ptt: 0
      },
      data: {
        status: 0,
        format: 'audio/L16;rate=16000',
        encoding: 'raw'
      }
    };
    iatWS?.send(JSON.stringify(params));
    if (STATUS_RECORD.isVW) {
      onStart?.();
    }
  }
  function onClose() {
    iatWS = null;
    isSpeaking = false;
    clearTimeout(timeout);
    clearTimeout(wsTimeOutId);
  }
  function createWS() {
    if (!iatWS || iatWS?.readyState === WebSocket.CLOSED) {
      iatWS = new WebSocket(getWebSocketUrl());
      resultTextTemp = '';
      resultText = '';
      iatWS.onopen = onOpen;
      iatWS.onclose = onClose;
      iatWS.onerror = (e) => {
        iatWS = null;
        onEnd?.();
        console.log(e);
        clearTimeout(timeout);
        clearTimeout(timerId);
        micVAD.start();
      };
      iatWS.onmessage = (evt) => {
        clearTimeout(timeout);
        clearTimeout(timerId);
        hasMessage = true;
        // 如果已经完成了唤醒，就进行问题的语音转换，否则就进行语音唤醒检查
        if (STATUS_RECORD.isVW) {
          renderResult(evt.data);
        } else {
          checkVWState(evt.data);
        }
      };

      wsTimeOutId = setTimeout(() => {
        if (iatWS?.readyState === WebSocket.CONNECTING) {
          iatWS.close();
          onEnd?.();
          iatWS = null;
          isSpeaking = false;
          micVAD.start();
          message.error('语音输入失败了，您可以在次提问试试。');
          console.log('语音转文本超时了');
        }
      }, 5 * 1000) as any;
    }
  }

  return micVAD;
}

/**
 * 获取websocket url
 * 该接口需要后端提供，这里为了方便前端处理
 */
function getWebSocketUrl() {
  // 请求地址根据语种不同变化
  let url = 'wss://iat-api.xfyun.cn/v2/iat';
  const host = 'iat-api.xfyun.cn';
  const apiKey = import.meta.env.VITE_APP_ARS_APP_KEY;
  const apiSecret = import.meta.env.VITE_APP_ARS_APP_SECRET;
  const date = new Date().toUTCString();
  const algorithm = 'hmac-sha256';
  const headers = 'host date request-line';
  const signatureOrigin = `host: ${host}\ndate: ${date}\nGET /v2/iat HTTP/1.1`;
  const signatureSha = HmacSHA256(signatureOrigin, apiSecret);
  const signature = enc.Base64.stringify(signatureSha);
  const authorizationOrigin = `api_key="${apiKey}", algorithm="${algorithm}", headers="${headers}", signature="${signature}"`;
  const authorization = btoa(authorizationOrigin);
  url = `${url}?authorization=${authorization}&date=${date}&host=${host}`;
  return url;
}

function encodePCM(bytes: Float32Array, sampleBits: number, littleEdian: boolean = true) {
  let offset = 0;
  const dataLength = bytes.length * (sampleBits / 8);
  const buffer = new ArrayBuffer(dataLength);
  const data = new DataView(buffer);

  // 写入采样数据
  if (sampleBits === 8) {
    for (let i = 0; i < bytes.length; i++, offset++) {
      // 范围[-1, 1]
      const s = Math.max(-1, Math.min(1, bytes[i]));
      // 8位采样位划分成2^8=256份，它的范围是0-255;
      // 对于8位的话，负数*128，正数*127，然后整体向上平移128(+128)，即可得到[0,255]范围的数据。
      let val = s < 0 ? s * 128 : s * 127;
      val = +val + 128;
      data.setInt8(offset, val);
    }
  } else {
    for (let i = 0; i < bytes.length; i++, offset += 2) {
      const s = Math.max(-1, Math.min(1, bytes[i]));
      // 16位的划分的是2^16=65536份，范围是-32768到32767
      // 因为我们收集的数据范围在[-1,1]，那么你想转换成16位的话，只需要对负数*32768,对正数*32767,即可得到范围在[-32768,32767]的数据。
      data.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, littleEdian);
    }
  }

  return data;
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

function getRMS(spectrum: Float32Array) {
  let rms = 0;
  for (let i = 0; i < spectrum.length; i++) {
    rms += spectrum[i] * spectrum[i];
  }
  rms /= spectrum.length;
  rms = Math.sqrt(rms);
  return rms;
}

function transF32ToS16(input: Float32Array) {
  const tmpData: number[] = [];
  for (let i = 0; i < input.length; i++) {
    const d = input[i] < 0 ? input[i] * 0x8000 : input[i] * 0x7fff;
    tmpData.push(d);
  }
  return new Int16Array(tmpData);
}

/**
 * 相似度对比
 * @param s 文本1
 * @param t 文本2
 * @param f 小数位精确度，默认2位
 * @returns {string|number|*} 百分数前的数值，最大100. 比如 ：90.32
 */
function similar(s: string, t: string, f = 2) {
  if (!s || !t) {
    return 0;
  }
  if (s === t) {
    return 100;
  }
  const l = s.length > t.length ? s.length : t.length;
  const n = s.length;
  const m = t.length;
  const d = [] as any[];
  f = f || 2;
  const min = (a: number, b: number, c: number) => {
    return a < b ? (a < c ? a : c) : b < c ? b : c;
  };
  let i, j, si, tj, cost;
  if (n === 0) return m;
  if (m === 0) return n;
  for (i = 0; i <= n; i++) {
    d[i] = [] as any;
    d[i][0] = i;
  }
  for (j = 0; j <= m; j++) {
    d[0][j] = j;
  }
  for (i = 1; i <= n; i++) {
    si = s.charAt(i - 1);
    for (j = 1; j <= m; j++) {
      tj = t.charAt(j - 1);
      if (si === tj) {
        cost = 0;
      } else {
        cost = 1;
      }
      d[i][j] = min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost);
    }
  }
  const res = (1 - d[n][m] / l) * 100;
  return Number(res.toFixed(f));
}
