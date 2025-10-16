import React, { createContext, useContext, useRef } from 'react';
import { Device, types } from 'mediasoup-client';
import { Participant, producerT, RoomType } from '../types/calls.types';
import {
  ProducerCore,
  useMediasoupProducers,
} from '../hooks/media/useMediasoupProducers';
import {
  ConsumerCore,
  useMediasoupConsumers,
} from '../hooks/media/useConsumers';
import useSocket from '../socket-client/useSocket';
import { registerGlobals } from 'react-native-webrtc';
registerGlobals();

export type DeviceCore = {
  getDevice: () => Device;
  initializeDevice: (
    roomId: string,
    rtpCapabilities: types.RtpCapabilities,
  ) => Promise<Device>;
  deviceRef: React.MutableRefObject<Device | null>;
};

interface MediasoupContextType {
  cleanUpMediaTransports(): Promise<void>;
  mediaDevice: DeviceCore;
  mediaProducers: ProducerCore;
  mediaConsumers: ConsumerCore;
  removeDevice: () => void;
}

const MediasoupContext = createContext<MediasoupContextType | undefined>(
  undefined,
);

export const MediasoupProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const socketContext = useSocket();
  const socket = socketContext.socket;
  const mediaDevice = useDevice();
  const mediaProducers = useMediasoupProducers({
    socket,
    getDevice: mediaDevice.getDevice,
  });

  const mediaConsumers = useMediasoupConsumers({
    socket,
    getDevice: mediaDevice.getDevice,
  });

  function removeDevice() {
    if (mediaDevice.deviceRef.current) {
      mediaConsumers.stopConsuming();
      mediaDevice.deviceRef.current = null;
      mediaConsumers.setRemoteVideoData([]);
      mediaProducers.stopProducing();
    }
  }

  async function cleanUpMediaTransports() {
    try {
      await mediaProducers.stopProducing();
      await mediaConsumers.stopConsuming();
    } catch (err) {
      console.log(err);
    }
  }

  return (
    <MediasoupContext.Provider
      value={{
        removeDevice,
        cleanUpMediaTransports,
        mediaProducers,
        mediaConsumers,
        mediaDevice,
      }}
    >
      {children}
    </MediasoupContext.Provider>
  );
};

export const useMediasoup = () => {
  const context = useContext(MediasoupContext);
  // console.log('context ', context);
  if (!context) {
    throw new Error('useMediasoup must be used within a MediasoupProvider');
  }
  return context;
};

export function useDevice(): DeviceCore {
  const deviceRef = useRef<Device | null>(null);

  const initializeDevice = async (
    roomId: string,
    rtpCapabilities: types.RtpCapabilities,
  ) => {
    try {
      const newDevice = new Device();
      await newDevice.load({
        routerRtpCapabilities: rtpCapabilities,
      });
      deviceRef.current = newDevice;
      return Promise.resolve(newDevice);
    } catch (err) {
      return Promise.reject(err);
    }
  };

  function getDevice() {
    if (!deviceRef.current) {
      throw new Error('Device not initialized');
    }
    return deviceRef.current;
  }

  return { getDevice, initializeDevice, deviceRef };
}
