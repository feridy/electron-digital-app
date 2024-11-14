import log from 'electron-log/main';
import path from 'path';
import fs from 'fs-extra';
// import uuid from 'uuid';
import dayjs from 'dayjs';

export function initMainLog() {
  // 保存已满的文件备份
  log.transports.file.archiveLogFn = (file) => {
    const info = path.parse(file.path);
    const fileState = fs.statSync(file.path);
    const date = dayjs(fileState.ctime).format('YYYY-MM-DD');

    fs.ensureFileSync(`${info.dir}/${date}.log`);

    fs.renameSync(file.path, `${info.dir}/${date}.log`);
  };

  // 自定义日志的保存位置
  log.transports.file.resolvePathFn = () => {
    return path.join(process.cwd(), './logs', `${dayjs().format('YYYY-MM-DD')}.log`);
  };

  const mainLog = log.scope('Main');
  log.initialize();
  Object.assign(console, mainLog);

  mainLog.info('..........开始启动程序..........');

  return mainLog;
}
