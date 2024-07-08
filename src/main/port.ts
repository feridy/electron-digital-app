import { SerialPort } from 'serialport';

export async function serialPortList() {
  const list = await SerialPort.list();

  return list;
}
