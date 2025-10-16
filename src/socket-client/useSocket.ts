import { useContext } from 'react';
import { SocketContext, SocketContextType } from './SocketProvider';

const useSocket = (): SocketContextType => {
  const socketState = useContext(SocketContext);

  return socketState;
};

export default useSocket;
