import { Socket } from 'socket.io-client';

export const socketListener = <TData>(
  socketParams: {
    socket: Socket;
    showLog?: boolean;
  },
  event: string,
  callback: (data: TData) => void,
) => {
  socketParams.socket.on(event, (data: TData) => {
    if (socketParams.showLog) {
      console.log(`%cListening to event: ${event}`, 'color: blue; font-weight: bold;');
    }
    callback(data);
  });
};
