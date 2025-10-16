import { io, Socket } from 'socket.io-client';
import SocketHandler from './SocketHandler';
import { Client } from '../lib/Client';
import { ProgressBarAndroidComponent } from 'react-native';

let socket: Socket<any, any> | null = null;

export let socketURL = 'https://test-server.chatbucket.chat/';
// let socketURL = 'ws://10.10.0.121:8088/';
// let socketURL = 'ws://161.35.37.230:8081/';
// let socketURL = 'ws://10.98.98.188:8088/';
// let socketURL = 'ws://10.33.227.59:8088/';
// let socketURL = 'ws://10.20.20.47:8089/';
// let socketURL = 'ws://10.33.227.59:8088/';

// Initialize the socket connection with the access token
export const initSocket = (
  accessToken: string,
  lastSynced: string | null,
  fcmToken: string,
  reinitialize?: boolean,
): Socket<any, any> => {
  // if (socket && !reinitialize) {
  //   console.log(`Returning existing socket instance:`, socket);
  //   return socket;
  // }

  const url = socketURL + `?token=${accessToken}`;
  console.log('url-->>', url);
  const newsocket = io(url, {
    transports: ['websocket', 'polling'],
  });
  console.log('Socket instance created:', newsocket);
  socket = newsocket;
  return newsocket;
};

export const initAuthSocket = (): Socket<any, any> => {
  socket = io(socketURL + '/auth', { transports: ['websocket'] });
  return socket;
};

export const getSocket = (): Socket<any, any> => {
  if (!socket) {
    throw new Error('Socket not initialized. Call initSocket first.');
  }
  return socket;
};

// Disconnect the socket and reset the instance
export const disconnectSocket = (): void => {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
};

export const connectToSocketServer = (token: string) => {
  const socket = initSocketAsync(token);

  return socket;
};

type HandleSocketEventsParams = {
  onConnect?: (socket: Socket) => void;
  onDisconnect?: (socket: Socket) => void;
  onAuthSuccess?: () => void;
  onAuthError?: (socket: Socket) => void;
  onError?: (socket: Socket) => void;
};

export const handleSocketEvents = (
  socket: Socket,
  params: HandleSocketEventsParams,
) => {
  socket.removeAllListeners();
  console.log('Handling socket events...');
  // Log incoming and outgoing events
  socket.onAny((event, ...args) => {
    console.log(`[incoming]: ${event}`, ...args);
  });
  socket.onAnyOutgoing((event, ...args) => {
    console.log(`[outgoing]: ${event}`, ...args);
  });

  // Handle socket events
  socket.on('connect', () => {
    params.onConnect?.(socket);
    SocketHandler.handleConnection();
    console.log('Socket connected', socket);
  });

  socket.on('authenticated', () => {
    params?.onAuthSuccess?.();
    SocketHandler.handleAuthentication();
  });
  socket.on('auth_error', err => {
    params?.onAuthError?.(socket);
    SocketHandler.handleAuthenticationError(err);
  });
  socket.on('connect_error', err => {
    params?.onError?.(socket);
    SocketHandler.handleErrors(err);
  });
  socket.on('ERROR', () => {
    params?.onError?.(socket);
    console.log(socket);
  });
  socket.on('disconnect', () => {
    params?.onDisconnect?.(socket);
    SocketHandler.handleDisconnection();
  });

  return () => {
    socket.removeAllListeners();
  };
};

export const clearSocket = () => {
  if (socket) socket.disconnect();
  socket = null;
};

export const initSocketAsync = (accessToken: string) => {
  const fcmToken = 'dummy token';
  const lastSynced = '';
  const socket = initSocket(accessToken, lastSynced, fcmToken);

  return socket;
};

let videoSummarySocket: Socket<any, any> | null = null;

export const initVideoSummarySocket = () => {
  const url = 'http://10.10.0.203:8080/';
  // const url = 'http://192.168.1.4:8080/';
  const socket = io(url, { transports: ['websocket'] });
  videoSummarySocket = socket;

  return socket;
};

export const getVideoSummarySocket = () => {
  console.log(videoSummarySocket?.connected);
  if (!videoSummarySocket || !videoSummarySocket?.connected) {
    console.log('Initializing video summary socket...');
    const vidSummSocket = initVideoSummarySocket();
    return vidSummSocket;
  }
  console.log('Video summary socket already initialized.');
  return videoSummarySocket;
};

export const clearVideoSummarySocket = () => {
  if (videoSummarySocket) videoSummarySocket.disconnect();
  videoSummarySocket = null;
};

export type AppSocket = Socket<any, any>;
