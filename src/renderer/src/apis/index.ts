import wretch from 'wretch';
import { md5 } from 'js-md5';
import dayjs from 'dayjs';
import QueryStringAddon from 'wretch/addons/queryString';
import AbortAddon from 'wretch/addons/abort';
import { fetchEventSource, EventStreamContentType } from '@microsoft/fetch-event-source';

export const REQUEST_TIMEOUT_MS = 1000 * 30;

export const BASE_URL = import.meta.env.VITE_APP_API_BASE_URL;

export const REQUEST_TAG = 'w';

const api = wretch(BASE_URL, {
  mode: 'cors'
})
  .addon(QueryStringAddon)
  .addon(AbortAddon())
  .query({ p: REQUEST_TAG })
  .errorType('json');
// 进行设备登录
export async function deviceLogin() {
  const ddNum = import.meta.env.VITE_APP_API_DD_NUM;
  const signTime = dayjs().format('YYYY-MM-DD HH:mm:ss');
  const willSign = ddNum + signTime + import.meta.env.VITE_APP_API_SECRET;
  const sign = md5(willSign);

  const response = await api
    .post({ dd_num: ddNum, sign_time: signTime, sign }, '/gllmapi/ddevice/login')
    .setTimeout(10 * 1000)
    .json<DeviceLoginResponse>();

  if (response?.status === 1) {
    window.token = response.data.jtoken;
    return response.data.jtoken;
  }

  throw new Error(response?.msg || '请求出现了异常，请稍后再试');
}

export function getChatMessageStream(question: string, options?: ChatOptions) {
  if (!window.token) {
    deviceLogin()
      .then(() => {
        getChatMessageStream(question, options);
      })
      .catch(() => {
        options?.onError?.(new Error('请求出现了异常，请稍后再试'));
      });

    return;
  }

  const controller = new AbortController();
  let finished = false;
  let responseText = '';
  let remainText = '';
  let originText = '';
  let time = Date.now();
  let prevLength = 0;
  let isOpen = false;
  const postAudio: string[] = [];
  let renderText = false;
  let isAbort = false;
  const finish = () => {
    if (!finished) {
      finished = true;
      options?.onFinish?.(responseText + remainText);
      // TTSRecorder.GetInstance().endSendTTS = true;
    }
  };
  function animateResponseText() {
    if (finished) {
      responseText += remainText;
      console.log('[Response Animation] finished');
      if (responseText?.length === 0 && !isOpen) {
        if (!isAbort) options?.onError?.(new Error('empty response from server'));
      }
      options?.onUpdate?.(responseText, remainText);
      return;
    }
    const frame = Date.now() - time;

    const diff = 80;
    const fetchCount = Math.max(1, Math.round(remainText.length / 60));
    const fetchText = remainText.slice(0, fetchCount);

    if (prevLength > 0 && frame >= diff && renderText) {
      time = Date.now();
      responseText += fetchText;
      remainText = remainText.slice(fetchCount);
      options?.onUpdate?.(responseText, fetchText);
    }

    requestAnimationFrame(animateResponseText);
  }

  controller.signal.onabort = () => {
    isAbort = true;
    clearTimeout(requestTimeoutId);
    finish();
  };

  const requestTimeoutId = setTimeout(() => {
    options?.onError?.(new Error('请求超时了'));
    controller.abort();
  }, REQUEST_TIMEOUT_MS);

  options?.onController?.(controller);

  // start animation
  animateResponseText();

  fetchEventSource(`${BASE_URL}/gllmapi/chatsse/ask?p=${REQUEST_TAG}`, {
    method: 'POST',
    signal: controller.signal,
    headers: {
      'Content-Type': 'application/json',
      Authorization: window.token
    },
    body: JSON.stringify({
      question,
      chat_key: options?.chatKey,
      is_audio: options?.isAudio
    }),
    async onopen(response) {
      clearTimeout(requestTimeoutId);
      if (
        !response.ok ||
        response.status !== 200 ||
        !response.headers.get('content-type')?.startsWith(EventStreamContentType)
      ) {
        const responseTexts = [responseText];
        let extraInfo = await response.clone().text();
        try {
          const resJson = await response.clone().json();
          options?.onError?.(resJson);
          extraInfo = prettyObject(resJson);
        } catch {
          // ignore
        }

        if (response.status === 401) {
          responseTexts.push('Unauthorized');
        }

        if (extraInfo) {
          responseTexts.push(extraInfo);
        }

        responseText = responseTexts.join('\n\n');

        console.log(responseText);

        return finish();
      }

      if (
        response.ok &&
        !response.headers.get('content-type')?.startsWith(EventStreamContentType)
      ) {
        try {
          const resJson = await response.clone().json();
          if (resJson.status === 405) {
            await deviceLogin();
            getChatMessageStream(question, options);
            return finish();
          }
        } catch (error) {
          console.log(error);
          return finish();
        }
      }
      isOpen = true;
      options?.onOpen?.(response);
    },
    async onmessage(event) {
      const message = event.data;
      // console.log(message)
      renderText = true;

      if (finished) {
        return finish();
      }

      const data = transformJson<ChatMessageDataResponse>(message);
      if (data) {
        if (data.status === 405) {
          controller.abort();
          await deviceLogin();
          getChatMessageStream(question, options);
          return;
        }
        if (data.status === 1) {
          remainText += data.data.response.slice(prevLength);
          prevLength = data.data.response.length;
          if (data.data.response_split?.length) {
            data.data.response_split.forEach((item) => {
              if (!postAudio.includes(item)) {
                postAudio.push(item);
                // console.log('[Audio]', item)
                // TTSRecorder.GetInstance().sendText(item, '', false);
              }
            });
          }
          if (data.data.is_end) {
            controller.abort();
            console.log(data);
            originText = data.data.response;
          }
          options?.onMessage?.(data.data);
          return;
        }
        if (data.msg) {
          options?.onError?.(data as any);
          remainText = data.msg;
        }
        console.log(data);
        controller.abort();
      }
    },
    onerror: (error) => {
      controller.abort();
      options?.onError?.(error);
      console.log(error);
      // onerror?.(error);
      throw error;
    },
    onclose: () => {
      // options?.onError?.(new Error('链接失败了'));
      console.log('服务器已经关闭');
      finish();
    },
    openWhenHidden: true
  });
}
export const transformJson = <T = any>(json: string, defaultVal?: T) => {
  if (!json) return defaultVal ?? null;
  if (typeof json === 'object') return json as T;
  try {
    const val = JSON.parse(json) as T;
    if (val) return val;
    return defaultVal;
  } catch (error) {
    return defaultVal;
  }
};

export function prettyObject(msg: any) {
  const obj = msg;
  if (typeof msg !== 'string') {
    msg = JSON.stringify(msg, null, '  ');
  }
  if (msg === '{}') {
    return obj.toString();
  }
  if (msg.startsWith('```json')) {
    return msg;
  }
  return ['```json', msg, '```'].join('\n');
}

export type DeviceLoginResponse = {
  status: number;
  msg: string;
  data: {
    jtoken: string;
  };
};

export type ChatMessageDataResponse = {
  status: number;
  msg: string;
  data: {
    chat_key: string;
    is_end: boolean;
    response: string;
    response_split: string[];
    recommend_collection: string[];
    recommend_location?: any;
    recommend_question?: any;
    document?: any;
  };
};

export interface ChatOptions {
  chatKey?: string;
  isAudio?: 1 | 0;
  onOpen?: (response: any) => void;
  onError?: (error: Error) => void;
  onFinish?: (message: string) => void;
  onUpdate?: (message: string, chunk: string) => void;
  onMessage?: (object: {
    chat_key: string;
    is_end: boolean;
    response: string;
    instruction?: string;
    instruction_recommend?: string[];
    response_split: string[];
    recommend_collection: string[];
    recommend_location?: any;
    recommend_question?: any;
    document?: any;
  }) => void;
  onController?: (controller: AbortController) => void;
}

export const ChatControllerPool = {
  controllers: {} as Record<string, AbortController>,

  addController(sessionId: string, messageId: string, controller: AbortController) {
    const key = this.key(sessionId, messageId);
    this.controllers[key] = controller;
    return key;
  },

  stop(sessionId: string, messageId: string) {
    const key = this.key(sessionId, messageId);
    const controller = this.controllers[key];
    controller?.abort();
  },

  stopAll() {
    Object.values(this.controllers).forEach((v) => (v as AbortController).abort());
  },

  hasPending() {
    return Object.values(this.controllers).length > 0;
  },

  remove(sessionId: string, messageId: string) {
    const key = this.key(sessionId, messageId);
    delete this.controllers[key];
  },

  key(sessionId: string, messageIndex: string) {
    return `${sessionId},${messageIndex}`;
  }
};
