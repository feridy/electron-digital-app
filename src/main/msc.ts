import koffi from 'koffi';
import path from 'path';

console.log(path.join(process.cwd(), './libs/msc/msc_x64.dll'));

const mscLib = koffi.load(path.join(process.cwd(), './libs/msc/msc_x64.dll'));

// 用户登录处理
export const mspLogin = (onSuccess?: () => void, onError?: (errCode: number) => void) => {
  console.log('---------MSPLogin Run------------');
  const login = mscLib.func('int MSPLogin(const char* usr, const char* pwd, const char* params)');
  const lgiParam = `appid = ${import.meta.env.VITE_APP_ARS_APP_ID}, engine_start = ivw, work_dir = .`;
  const res = login(null, null, lgiParam);
  if (res === 0) {
    console.log('-----MSPLogin Success-------');
    onSuccess?.();
  } else {
    console.log(`-----MSPLogin Fail Code: ${res}`);
    onError?.(res);
  }
};
// 开启语音唤醒功能Session
export const vwSessionBegin = (
  onSuccess?: (sessionId: string) => void,
  onError?: (errCode: number) => void
) => {
  const resPath = path.join(process.cwd(), './libs/msc/res/ivw/wakeupresource.jet');
  const ssbStr = `ivw_threshold=0:1450,sst=wakeup,ivw_res_path =fo|${resPath}`;
  let errorCode = [0];
  const begin = mscLib.func(
    'const char* QIVWSessionBegin(const char *grammarList, const char *params, _Inout_ int *errorCode)'
  );
  const sessionId = begin(null, ssbStr, errorCode) as string;

  if (errorCode[0] === 0) {
    console.log(`-----开启了语音唤醒功能的Session成功，SessionId: ${sessionId}------`);
    // 开启监听
    const IvwNotifyCallback = koffi.proto(
      'int IvwNotifyCallback(const char *sessionID, int msg, int param1, int param2, const void *info, void *userData)'
    );
    const callback = koffi.register(
      (
        _sessionId: string,
        code: number,
        param1: number,
        _param2: number,
        info: any,
        userData: any
      ) => {
        if (code === 2) {
          console.log(`---唤醒出现了异常，${param1}-----`);
        } else if (code === 1) {
          console.log(`------唤醒成功，可以进行后续的处理----------`);
          let str1 = koffi.decode(info, 'char *');
          console.log(str1);
        }
        console.log(userData);
        // 取消注册
        koffi.unregister(callback);
        return 0;
      },
      koffi.pointer(IvwNotifyCallback)
    );
    const notify = mscLib.func(
      'int QIVWRegisterNotify(const char *sessionID, IvwNotifyCallback *msgProcCb, void *userData)'
    );
    const notifyCode = notify(sessionId, callback, null);
    if (notifyCode !== 0) {
      console.log(`------唤醒Callback的绑定失败，失败码: ${notifyCode}-------`);
    } else {
      console.log(`------唤醒Callback的绑定成功-------`);
    }

    onSuccess?.(sessionId);
  } else {
    console.log(`-----开启了语音唤醒功能的Session失败， 失败码为: ${errorCode}--------`);
    onError?.(errorCode[0]);
  }
};

// 登出处理
export const doQIVWLogout = () => {
  const logout = mscLib.func('init MSPLogout()');
  const code = logout();
  if (code === 0) {
    console.log('-----MSPLogout成功-----');
  } else {
    console.log(`-----MSPLogout失败，失败码:${code}-----`);
  }
};

// 结束语音唤醒的Session
export const vwSessionEnd = (sessionId: string, reason: string) => {
  const stop = mscLib.func(`int IVWSessionEnd(const char * 	sessionID,const char * 	hints)`);
  const code = stop(sessionId, reason);
  if (code === 0) {
    console.log('-------结束唤醒Session成功----------');
  } else {
    console.log(`-------结束唤醒Session失败，失败码: ${code}----------`);
  }
};

// 处理语音，进行语音识别检查
export const qIVWAudioWrite = (sessionId: string) => {
  const write = mscLib.func(
    `int QIVWAudioWrite(const char * 	sessionID,const void * 	audioData, unsigned int 	audioLen, int audioStatus)`
  );
};
