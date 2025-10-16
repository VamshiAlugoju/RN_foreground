import { createContext, useContext, useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { connectToSocketServer, handleSocketEvents, socketURL } from './socket';
import { IUser, userList } from '../types/user.type';
import { UserContext } from '../context/userProvider';

const userTokenMap: Map<string, string> = new Map();

userTokenMap.set(userList[0].id, 'token1');
userTokenMap.set(userList[1].id, 'token2');
userTokenMap.set(userList[2].id, 'token3');

type SocketConnectionStatus = 'connecting' | 'connected' | 'disconnected';

export type SocketContextType = {
  status: SocketConnectionStatus;
  socket: Socket;
  error: any;
  type: 'auth' | 'chat';
  connectSocket: (user: IUser) => Promise<boolean>;
};

const initialSocket = io(socketURL + '/auth', { transports: ['websocket'] });

export const SocketContext = createContext<SocketContextType>({
  status: 'disconnected',
  socket: initialSocket,
  error: null,
  type: 'auth',
  connectSocket: () => Promise.resolve(false),
});

type SocketProviderProps = {
  children: React.ReactNode;
};

const SocketProvider = ({ children }: SocketProviderProps) => {
  const { user, setUser } = useContext(UserContext);

  const [socketState, setSocketState] = useState<SocketContextType>({
    status: 'disconnected',
    socket: initialSocket,
    error: null,
    type: 'auth',
    connectSocket,
  });

  function onSocketConnect(socket: Socket) {
    setSocketState(prevState => ({
      ...prevState,
      socket,
      status: 'connected',
      error: null,
      type: 'auth',
    }));
  }

  function onAuthSuccess() {
    setSocketState(prevState => ({
      ...prevState,
      status: 'connected',
      error: null,
      type: 'chat',
    }));
  }

  function onAuthError(socket: Socket) {
    setSocketState(prevState => ({
      ...prevState,
      status: 'disconnected',
      error: null,
      type: 'auth',
    }));
  }

  function onError(socket: Socket) {
    setSocketState(prevState => ({
      ...prevState,
      status: 'disconnected',
      error: null,
      type: 'auth',
    }));
  }

  function onDisconnect(socket: Socket) {
    setSocketState(prevState => ({
      ...prevState,
      status: 'disconnected',
      error: null,
      type: 'auth',
    }));
  }

  function connectSocket(user: IUser) {
    try {
      const socket: any = connectToSocketServer(user.accessToken);
      if (socket) {
        handleSocketEvents(socket, {
          onConnect: onSocketConnect,
          onAuthSuccess: onAuthSuccess,
          onAuthError: onAuthError,
          onError: onError,
          onDisconnect: onDisconnect,
        });
        setSocketState(prevState => ({
          ...prevState,
          socket,
          status: 'connected',
          error: null,
          type: 'auth',
        }));
        setUser(user);
        return Promise.resolve(true);
      }
      return Promise.reject('Failed to connect to socket server');
    } catch (err) {
      return Promise.reject(err);
    }
  }

  return (
    <SocketContext.Provider value={{ ...socketState, connectSocket }}>
      {children}
    </SocketContext.Provider>
  );
};

export default SocketProvider;
