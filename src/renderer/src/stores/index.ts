import { defineStore } from 'pinia';
import { ref, shallowRef, watch } from 'vue';
import { AudioPlayer, AudioPlayerEventKey } from '../player';
import { nanoid } from '@rubik/utils';
import { MicVAD } from '@renderer/vad-web';
import { ChatControllerPool, getChatMessageStream } from '@renderer/apis';

export const useStore = defineStore('pageStore', () => {
  // 数字人加载完成
  const isLoadHuman = ref(false);
  // 音频播放器
  const audioPlayer = shallowRef<AudioPlayer | null>(null);
  // vad录音检测功能
  const vadInstance = shallowRef<MicVAD>();
  // 多轮对话使用的列表
  const chatKeys = ref<string[]>([]);
  // 展示问答的答案
  const showAiAnswer = ref('');
  // AI问答的讲解答案
  const getChatAnswer = ref('');
  // 要进行说话帧与文本内容匹配的index
  const answerTextIndex = ref(0);
  // 当前会话的SessionId
  const currentAnswerSessionId = ref('');
  //TTS转换的状态记录
  const isGetChatMessageStreamFinish = ref(false);
  // 提交TTS的音频状态
  const postAudio = ref<string[]>([]);
  // AI与TTS的状态
  const isHandling = ref(false);
  // AI已经回答完的状态
  const isHandleCompleted = ref(false);

  // 问答会话的内容
  const chatMessages = ref<
    {
      id: string;
      isUser?: boolean;
      message?: string;
      isLoading?: boolean;
      recommends?: string[];
      instruction?: string[];
      isAudioEnd?: boolean;
      chatKey?: string;
    }[]
  >([]);

  function humanLoadSuccess() {
    isLoadHuman.value = true;
  }

  async function sendMicText(message: string) {
    if (!message.trim()) {
      return;
    }

    let isSendTTS = false;
    isHandling.value = true;
    isHandleCompleted.value = false;
    const sessionId = nanoid();
    const hashCode = await hashString(message);
    const hasSaveAudioList: string[] = [];
    isGetChatMessageStreamFinish.value = false;
    postAudio.value.length = 0;
    getChatAnswer.value = '';
    answerTextIndex.value = 0;
    // 用户提问的会话
    chatMessages.value.push({
      id: nanoid(),
      isUser: true,
      message: message
    });

    // AI回答的会话
    chatMessages.value.push({
      id: sessionId,
      isLoading: true,
      message: ''
    });

    // AI最新回答的会话
    const robotChatMessage = chatMessages.value[chatMessages.value.length - 1];

    getChatMessageStream(message, {
      // 最新的一次会话的Id
      chatKey: chatKeys.value.slice(-1)[0],
      onOpen() {
        // router.push('/ai-answer');
      },
      onMessage(object) {
        if (!chatKeys.value.includes(object.chat_key)) {
          chatKeys.value.push(object.chat_key);
          robotChatMessage.chatKey = object.chat_key;
        }
        if (object.is_end && object.recommend_question) {
          robotChatMessage.recommends = object.recommend_question;
        }
        // 不是预制问题的处理，就是推理的问题的处理
        if (object.response_split?.length && !object.instruction) {
          object.response_split.forEach((item) => {
            if (!isSendTTS) {
              hasSaveAudioList.push(item);
              if (hasSaveAudioList.join('').length >= 10) {
                audioPlayer.value?.sendWsText(item, object.is_end);
                isSendTTS = true;
              }
            } else if (!hasSaveAudioList.includes(item)) {
              postAudio.value.push(item);
              hasSaveAudioList.push(item);
            }
          });
          if (object.is_end && !isSendTTS) {
            audioPlayer.value?.sendWsText(object.response, object.is_end);
            isSendTTS = true;
          }
        }

        if (!isSendTTS && !object.response_split?.length && object.is_end) {
          audioPlayer.value?.sendWsText(object.response, object.is_end);
          robotChatMessage.isLoading = false;
          robotChatMessage.message = object.response;
          isSendTTS = true;
        }
      },
      onError(error) {
        robotChatMessage.id = nanoid();
        if ((error as any).msg) {
          getChatAnswer.value = (error as any).msg;
          robotChatMessage.message = getChatAnswer.value;
          showAiAnswer.value = getChatAnswer.value;
        } else {
          robotChatMessage.message = '问答服务请求已经超时了，请稍后再试';
          showAiAnswer.value = '问答服务请求已经超时了，请稍后再试';
        }
        audioPlayer.value?.sendWsText(showAiAnswer.value, true);
        robotChatMessage.isLoading = false;
        ChatControllerPool.remove(sessionId, hashCode);
        currentAnswerSessionId.value = '';
        robotChatMessage.isAudioEnd = true;
        isGetChatMessageStreamFinish.value = true;
        // vadInstance.value?.start();
        // isHandling.value = false;
        console.error('[Chat] failed ', error);
      },
      onUpdate(message) {
        getChatAnswer.value = message;
        // robotChatMessage.message = message;
      },
      onFinish() {
        // 结束
        ChatControllerPool.remove(sessionId, hashCode);
        isGetChatMessageStreamFinish.value = true;
      },
      onController(controller) {
        ChatControllerPool.addController(sessionId, hashCode, controller);
      }
    });

    currentAnswerSessionId.value = sessionId;

    return sessionId;
  }

  function setVad(vad: MicVAD) {
    vadInstance.value = vad;
  }

  function reset() {
    postAudio.value.length = 0;
    isHandling.value = false;
    ChatControllerPool.stopAll();
    chatKeys.value.length = 0;
    showAiAnswer.value = '';
    currentAnswerSessionId.value = '';
    vadInstance.value?.start();
    audioPlayer.value?.reset();
  }

  function setAudioPlayer(player: AudioPlayer | null) {
    audioPlayer.value = player;
  }

  watch(
    () => audioPlayer.value,
    () => {
      if (!audioPlayer.value) return;
      let startTime = 0;
      let diff = 0;
      // 一段文本完成了TTS转义后的处理
      audioPlayer.value.addEventListener(AudioPlayerEventKey.WSClosed, () => {
        if (isGetChatMessageStreamFinish.value) {
          const text = postAudio.value.join('');
          postAudio.value.length = 0;
          if (text) {
            audioPlayer.value?.sendWsText(text, true);
            return;
          }
        }
        const next = postAudio.value.shift();
        if (next) {
          audioPlayer.value?.sendWsText(next, isGetChatMessageStreamFinish.value);
        }
      });
      audioPlayer.value.addEventListener(AudioPlayerEventKey.WSError, () => {
        vadInstance.value?.start();
        const robotChatMessage = chatMessages.value[chatMessages.value.length - 1];
        robotChatMessage.message = showAiAnswer.value;
        robotChatMessage.isAudioEnd = true;
        robotChatMessage.isLoading = false;
        isHandling.value = false;
      });
      audioPlayer.value.addEventListener(AudioPlayerEventKey.WSTimeout, (event) => {
        audioPlayer.value?.reset();
        vadInstance.value?.start();
        const robotChatMessage = chatMessages.value[chatMessages.value.length - 1];
        robotChatMessage.message = showAiAnswer.value;
        robotChatMessage.isAudioEnd = true;
        robotChatMessage.isLoading = false;
        isHandling.value = false;
        if (isGetChatMessageStreamFinish) {
          robotChatMessage.message = showAiAnswer.value;
        } else {
          robotChatMessage.message = event.endText;
        }
      });
      audioPlayer.value.addEventListener(AudioPlayerEventKey.AudioPlay, () => {
        vadInstance.value?.pause();
        startTime = Date.now();
        // 对于最新的问答会话方式的展示问答
        const robotChatMessage = chatMessages.value[chatMessages.value.length - 1];
        if (robotChatMessage) {
          robotChatMessage.isLoading = false;
          isHandling.value = false;
        }
      });
      audioPlayer.value.addEventListener(AudioPlayerEventKey.AudioStop, () => {
        setTimeout(() => {
          // 这个是所有的都提交了TTS
          if (!postAudio.value.length && !audioPlayer.value?.ws) {
            console.log('播放的音频中断');
            vadInstance.value?.start();
          }

          if (isGetChatMessageStreamFinish && !audioPlayer.value?.ws) {
            showAiAnswer.value = getChatAnswer.value;
            // 对于最新的问答会话方式的展示问答
            const robotChatMessage = chatMessages.value[chatMessages.value.length - 1];
            if (robotChatMessage) {
              robotChatMessage.message = showAiAnswer.value;
              robotChatMessage.isAudioEnd = true;
              isHandleCompleted.value = true;
              currentAnswerSessionId.value = '';
            }
          }
        }, 0);
      });
      audioPlayer.value.addEventListener(AudioPlayerEventKey.AudioTimeupdate, () => {
        const currentTime = Date.now();
        diff += (currentTime - startTime) / 100;
        if (diff > 1.5) {
          showAiAnswer.value = getChatAnswer.value.slice(0, answerTextIndex.value);
          // 对于最新的问答会话方式的展示问答
          const robotChatMessage = chatMessages.value[chatMessages.value.length - 1];
          if (robotChatMessage) {
            robotChatMessage.isLoading = false;
            robotChatMessage.message = showAiAnswer.value;
            answerTextIndex.value += 1;
            diff = 0;
          }
        }
        startTime = currentTime;
      });
    },
    {
      immediate: true
    }
  );

  // onMounted(() => {
  //   let startTime = 0;
  //   let diff = 0;
  //   // 一段文本完成了TTS转义后的处理
  //   audioPlayer.value.addEventListener(AudioPlayerEventKey.WSClosed, () => {
  //     if (isGetChatMessageStreamFinish.value) {
  //       const text = postAudio.value.join('');
  //       postAudio.value.length = 0;
  //       if (text) {
  //         audioPlayer.value.sendWsText(text, true);
  //         return;
  //       }
  //     }
  //     const next = postAudio.value.shift();
  //     if (next) {
  //       audioPlayer.value.sendWsText(next, isGetChatMessageStreamFinish.value);
  //     }
  //   });
  //   audioPlayer.value.addEventListener(AudioPlayerEventKey.WSError, () => {
  //     vadInstance.value?.start();
  //     const robotChatMessage = chatMessages.value[chatMessages.value.length - 1];
  //     robotChatMessage.message = showAiAnswer.value;
  //     robotChatMessage.isAudioEnd = true;
  //     robotChatMessage.isLoading = false;
  //     isHandling.value = false;
  //   });
  //   audioPlayer.value.addEventListener(AudioPlayerEventKey.WSTimeout, (event) => {
  //     audioPlayer.value.reset();
  //     vadInstance.value?.start();
  //     const robotChatMessage = chatMessages.value[chatMessages.value.length - 1];
  //     robotChatMessage.message = showAiAnswer.value;
  //     robotChatMessage.isAudioEnd = true;
  //     robotChatMessage.isLoading = false;
  //     isHandling.value = false;
  //     if (isGetChatMessageStreamFinish) {
  //       robotChatMessage.message = showAiAnswer.value;
  //     } else {
  //       robotChatMessage.message = event.endText;
  //     }
  //   });
  //   audioPlayer.value.addEventListener(AudioPlayerEventKey.AudioPlay, () => {
  //     vadInstance.value?.pause();
  //     startTime = Date.now();
  //     // 对于最新的问答会话方式的展示问答
  //     const robotChatMessage = chatMessages.value[chatMessages.value.length - 1];
  //     if (robotChatMessage) {
  //       robotChatMessage.isLoading = false;
  //       isHandling.value = false;
  //     }
  //   });
  //   audioPlayer.value.addEventListener(AudioPlayerEventKey.AudioStop, () => {
  //     setTimeout(() => {
  //       if (!postAudio.value.length) {
  //         console.log('播放的音频中断');
  //         vadInstance.value?.start();
  //       }
  //       if (isGetChatMessageStreamFinish && !audioPlayer.value.ws) {
  //         showAiAnswer.value = getChatAnswer.value;
  //         // 对于最新的问答会话方式的展示问答
  //         const robotChatMessage = chatMessages.value[chatMessages.value.length - 1];
  //         if (robotChatMessage) {
  //           robotChatMessage.message = showAiAnswer.value;
  //           robotChatMessage.isAudioEnd = true;
  //           isHandleCompleted.value = true;
  //           currentAnswerSessionId.value = '';
  //         }
  //       }
  //     }, 0);
  //   });
  //   audioPlayer.value.addEventListener(AudioPlayerEventKey.AudioTimeupdate, () => {
  //     const currentTime = Date.now();
  //     diff += (currentTime - startTime) / 100;
  //     if (diff > 1.5) {
  //       showAiAnswer.value = getChatAnswer.value.slice(0, answerTextIndex.value);
  //       // 对于最新的问答会话方式的展示问答
  //       const robotChatMessage = chatMessages.value[chatMessages.value.length - 1];
  //       if (robotChatMessage) {
  //         robotChatMessage.isLoading = false;
  //         robotChatMessage.message = showAiAnswer.value;
  //         answerTextIndex.value += 1;
  //         diff = 0;
  //       }
  //     }
  //     startTime = currentTime;
  //   });
  // });

  return {
    isLoadHuman,
    audioPlayer,
    isHandling,
    showAiAnswer,
    isHandleCompleted,
    setAudioPlayer,
    reset,
    setVad,
    sendMicText,
    humanLoadSuccess
  };
});

async function hashString(message: string) {
  const encoder = new TextEncoder();
  const data = encoder.encode(message);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}
