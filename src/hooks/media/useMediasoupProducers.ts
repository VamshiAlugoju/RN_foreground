import { RefObject, SetStateAction, useRef, useState, Dispatch } from 'react';
import { types } from 'mediasoup-client';
import { mediaDevices, MediaStreamTrack } from 'react-native-webrtc';

import {
  HandleMediasoupProducersProps,
  producerT,
  StartProducingOptions,
} from '../../types/calls.types';

import { mediaSocketEvents } from '../../socket-client/socketEvents';
import { errorToast, successToast } from '../../utils/commonFunction';

// import {
//   showDisplayProjectionNotification,
//   stopForegroundService,
// } from '../../firebase/notifications/callNoitificationHandler';
// import { getSocket } from '../../socket-client/socket';

export type ProducerCore = {
  createProducerTransport: (roomId: string, callType: string) => Promise<void>;
  setupProducerTransportEvents: (
    producerTransport: types.Transport,
    roomId: string,
  ) => void;
  startProducing: (
    producerTransport: types.Transport,
    callType: string,
  ) => Promise<void>;
  produceAudio: ({ isScreenSharing }: StartProducingOptions) => Promise<void>;
  produceScreenMedia: () => Promise<boolean>;
  flipCamera: () => Promise<void>;
  stopProducing: () => Promise<void>;
  producers: producerT;
  producerTransportRef: RefObject<types.Transport<types.AppData> | null>;
  produceVideo: ({ isScreenSharing }: StartProducingOptions) => Promise<
    | types.Producer<{
        isScreenSharing: boolean | undefined;
      }>
    | undefined
  >;
  setProducers: Dispatch<SetStateAction<producerT>>;
  stopScreenMedia: () => Promise<void>;
  initiateScreenMedia: () => Promise<{
    status: boolean;
    displayMediaTrack: MediaStreamTrack | null;
    error?: any;
  }>;
  produceScreenShare: (displayMediaTrack: MediaStreamTrack) => Promise<{
    status: boolean;
  }>;
  hasScreenSharingRequest: RefObject<boolean>;
};

export function useMediasoupProducers({
  socket,
  getDevice,
}: HandleMediasoupProducersProps): ProducerCore {
  const producerTransportRef = useRef<types.Transport | null>(null);
  const [producers, setProducers] = useState<producerT>({
    facing_mode: 'front',
  });
  const hasScreenSharingRequest = useRef<boolean>(false);

  // const transportMoniterRef = useRef<TransportMonitor | null>(null);
  const createProducerTransport = async (roomId: string, callType: string) => {
    const device = getDevice();

    socket.emit(
      mediaSocketEvents.CREATE_PRODUCER_TRANSPORT,
      { roomId, callType },
      async (transportOptions: any) => {
        try {
          console.log('transportOptions', transportOptions);
          const producerTransport =
            device.createSendTransport(transportOptions);
          producerTransportRef.current = producerTransport;
          // transportMoniterRef.current = new TransportMonitor({
          //   transport: producerTransport,
          //   kind: 'producer',
          //   logger: console.log,
          // });
          setupProducerTransportEvents(producerTransport, roomId);
          await startProducing(producerTransport, callType);
        } catch (err) {
          console.error('❌ Failed to create producer transport:', err);
        }
      },
    );
  };

  const setupProducerTransportEvents = (
    producerTransport: types.Transport,
    roomId: string,
  ) => {
    producerTransport.on('connect', ({ dtlsParameters }, callback, errback) => {
      socket.emit(
        mediaSocketEvents.CONNECT_PRODUCER_TRANSPORT,
        { dtlsParameters, roomId },
        (data: any) =>
          data?.status
            ? callback()
            : errback(new Error('Failed to connect transport')),
      );
    });

    producerTransport.on(
      'produce',
      ({ kind, rtpParameters, appData }, callback, errback) => {
        socket.emit(
          mediaSocketEvents.PRODUCE,
          {
            id: producerTransport.id,
            kind,
            rtpParameters,
            appData,
            roomId,
            isScreenShare: appData?.isScreenSharing
              ? appData.isScreenSharing
              : false,
          },
          (data: { id: string }) => callback({ id: data.id }),
        );
      },
    );

    producerTransport.on('connectionstatechange', async state => {
      // if (state === 'failed') {
      console.log('🚨 Producer transport connection failed.', state);
      // const stats = await producerTransport.getStats();
      // console.table(Array.from(stats));
      // }
    });
  };

  const startProducing = async (
    producerTransport: types.Transport,
    callType: string,
  ) => {
    if (callType === 'audio') {
      await produceAudio({});
    } else if (callType === 'video') {
      await Promise.all([produceAudio({}), produceVideo({})]);
    }
  };

  const produceAudio = async ({ isScreenSharing }: StartProducingOptions) => {
    try {
      const transport = producerTransportRef.current;
      if (!transport) throw new Error('No transport available');

      const stream = await mediaDevices.getUserMedia({
        audio: true,
      });
      const track = stream.getAudioTracks()[0];
      if (!track) throw new Error('No audio track available');

      const audioProducer = await transport.produce({
        track,
        appData: { isScreenSharing },
      });

      setProducers(prev => {
        return {
          ...prev,
          audioProducer,
          audioTrack: track,
          isAudioPaused: false,
        };
      });
    } catch (err) {
      console.error('🎤 Failed to produce audio:', err);
    }
  };

  const produceVideo = async ({ isScreenSharing }: StartProducingOptions) => {
    try {
      const transport = producerTransportRef.current;
      if (!transport) throw new Error('No transport available');
      const stream = await mediaDevices.getUserMedia({
        video: { width: { ideal: 1920 }, height: { ideal: 1080 } },
      });

      const track = stream.getVideoTracks()[0];
      if (!track) throw new Error('No video track available');
      const bitrate_480 = 700_000;
      const bitrate_720 = 1_500_000;
      const bitrate_360 = 500_000; // 500 kbps

      const videoProducer = await transport.produce({
        track,
        encodings: [
          {
            maxBitrate: bitrate_360, // ~360p
            scaleResolutionDownBy: 2.0, // 720 / 2 ≈ 360
          },
          {
            maxBitrate: bitrate_480, // ~480p
            scaleResolutionDownBy: 1.5, // 720 / 1.5 ≈ 480
          },
          {
            maxBitrate: bitrate_720, // ~720p
            scaleResolutionDownBy: 1.0, // no downscale
          },
        ],
        codecOptions: {
          // videoGoogleStartBitrate: 1000,
        },
        appData: { isScreenSharing },
      });

      setProducers(prev => ({
        ...prev,
        videoProducer,
        videoTrack: track,
        isVideoPaused: false,
        videoStream: stream,
        isScreenSharing,
        facing_mode: 'front',
      }));

      return videoProducer;
    } catch (err) {
      console.error('📹 Failed to produce video:', err);
    }
  };

  const initiateScreenMedia = async () => {
    try {
      // await showDisplayProjectionNotification();

      const screenStream = await mediaDevices.getDisplayMedia();

      const VideoTrack = screenStream.getVideoTracks()[0];
      setProducers(prev => ({
        ...prev,
        displayTrack: VideoTrack,
      }));
      return Promise.resolve({
        status: true,
        displayMediaTrack: VideoTrack,
        error: null,
      });
    } catch (error) {
      return Promise.resolve({
        status: false,
        error,
        displayMediaTrack: null,
      });
    }
  };

  const produceScreenShare = async (displayTrack: MediaStreamTrack) => {
    try {
      const transport = producerTransportRef.current;
      if (!transport) throw new Error('No transport available');
      const [videoProducer] = await Promise.all([
        transport.produce({
          track: displayTrack,
          appData: { isScreenSharing: true },
        }),
      ]);
      setProducers(prev => ({
        ...prev,
        videoScreenShareProducer: videoProducer,
        isScreenSharing: true,
      }));
      return Promise.resolve({ status: true });
    } catch (error) {
      return Promise.reject({
        status: false,
        error,
      });
    }
  };

  const produceScreenMedia = async () => {
    try {
      // await showDisplayProjectionNotification();

      const transport = producerTransportRef.current;
      if (!transport) throw new Error('No transport available');
      const screenStream = await mediaDevices.getDisplayMedia();

      const VideoTrack = screenStream.getVideoTracks()[0];
      const [videoProducer] = await Promise.all([
        transport.produce({
          track: VideoTrack,
          appData: { isScreenSharing: true },
        }),
      ]);

      setProducers(prev => ({
        ...prev,
        videoScreenShareProducer: videoProducer,
        isScreenSharing: true,
      }));
      return Promise.resolve(true);
    } catch (err) {
      console.log(err, '>>>>>>>>>>>>>>> screen sharing error');
      return Promise.reject(err);
    }
  };

  const stopScreenMedia = async () => {
    const displayVideoProducer = producers.videoScreenShareProducer;
    displayVideoProducer?.close();
    const displayTrack = producers.displayTrack;
    displayTrack?.stop();
    setProducers(prev => ({
      ...prev,
      isScreenSharing: false,
      videoScreenShareProducer: undefined,
      displayTrack: undefined,
    }));
    // await stopForegroundService();
  };

  const flipCamera = async () => {
    try {
      if (producers?.videoTrack?._switchCamera) {
        producers.videoTrack._switchCamera();
        successToast('Camera switched successfully.');
      } else {
        throw new Error('Camera switch function is unavailable.');
      }
    } catch (err) {
      errorToast('Unable to switch camera at the moment.');
    }
  };

  const stopProducing = async () => {
    producers?.audioProducer?.close();
    producers?.videoProducer?.close();
    producers?.videoScreenShareProducer?.close();
    producers?.audioScreenShareProducer?.close();
    producerTransportRef.current?.close();
    producerTransportRef.current = null;
    // transportMoniterRef.current?.cleanUp();
    // transportMoniterRef.current = null;
    producers.videoStream?.getTracks().map(track => {
      track.stop();
    });
    setProducers({});
    // await stopForegroundService();
  };

  return {
    createProducerTransport,
    stopProducing,
    produceAudio,
    produceVideo,
    startProducing,
    producers,
    producerTransportRef,
    setupProducerTransportEvents,
    flipCamera,
    produceScreenMedia,
    setProducers,
    stopScreenMedia,
    initiateScreenMedia,
    produceScreenShare,
    hasScreenSharingRequest,
  };
}
