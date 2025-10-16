import { useEffect, useRef, useState, useCallback } from 'react';
import { DeviceEventEmitter } from 'react-native';
import InCallManager from 'react-native-incall-manager';
import { getRingerMode, RINGER_MODE } from 'react-native-volume-manager';

export type MediaType = 'audio' | 'video';

interface WiredHeadsetData {
  isPlugged: boolean;
  hasMic: boolean;
  deviceName: string;
}

export enum CallDirection {
  INCOMING = 'incoming',
  OUTGOING = 'outgoing',
}

export interface UseInCallManagerResult {
  isSpeakerOn: boolean;
  isMuted: boolean;
  isCallActive: boolean;
  proximityState: boolean | null;
  hasHeadsetPluggedIn: boolean | null;
  currentMediaType: MediaType;
  startCallSession: (mediaType: MediaType, callDirection: CallDirection) => void;
  stopCallSession: () => void;
  toggleMediaType: (mediaType: MediaType) => void;
  enableSpeaker: () => void;
  disableSpeaker: () => void;
  toggleSpeaker: () => void;
  muteMicrophone: () => void;
  unmuteMicrophone: () => void;
  toggleMicrophoneMute: () => void;
  startRingtone: (type: string) => void;
  stopRingtone: () => void;
  startRingback: (type: string) => void;
  stopRingback: () => void;
  turnScreenOff: () => void;
  turnScreenOn: () => void;
  setKeepScreenOn: (flag: boolean) => void;
  onProximityChange: (callback?: (isNear: boolean) => void) => void;
  onWiredHeadsetChange: (callback?: (data: WiredHeadsetData) => void) => void;
  onAudioFocusChange: (callback: (data: any) => void) => void;
  onNoisyAudio: (callback: (data: any) => void) => void;
}

export function useInCallManager(): UseInCallManagerResult {
  const [isSpeakerOn, setIsSpeakerOn] = useState<boolean>(false);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [isCallActive, setIsCallActive] = useState<boolean>(false);
  const [proximityState, setProximityState] = useState<boolean | null>(null);
  const [hasHeadsetPluggedIn, setHasHeadsetPluggedIn] = useState<boolean | null>(null);
  const [currentMediaType, setCurrentMediaType] = useState<MediaType>('audio');

  const proximityListener = useRef<any>(null);
  const headsetListener = useRef<any>(null);
  const audioFocusListener = useRef<any>(null);
  const noisyAudioListener = useRef<any>(null);

  // ------------------ Call Lifecycle ------------------

  const startCallSession = useCallback(
    (mediaType: MediaType = 'audio', callDirection: CallDirection) => {
      if (mediaType === 'audio') {
        if (callDirection === CallDirection.INCOMING) {
          InCallManager.start({ media: mediaType });
        } else {
          InCallManager.start({ media: mediaType, ringback: '_DTMF_' });
        }
        InCallManager.setKeepScreenOn(false); // Let proximity sensor control screen
        InCallManager.startProximitySensor();
        disableSpeaker();
      } else {
        InCallManager.start({ media: mediaType });
        InCallManager.setKeepScreenOn(true); // Keep screen on for video
        InCallManager.stopProximitySensor();
        enableSpeaker();
      }

      setIsCallActive(true);
      setCurrentMediaType(mediaType);
    },
    [],
  );

  const stopCallSession = useCallback(() => {
    InCallManager.stop();
    InCallManager.stopProximitySensor();
    InCallManager.setKeepScreenOn(false);
    InCallManager.stopRingback();
    InCallManager.stopRingtone();
    setIsSpeakerOn(false);
    setIsMuted(false);
    setIsCallActive(false);
    setCurrentMediaType('audio');
  }, []);

  const toggleMediaType = useCallback((mediaType: MediaType) => {
    InCallManager.stop();
    InCallManager.start({ media: mediaType });

    if (mediaType === 'audio') {
      InCallManager.setKeepScreenOn(false);
      InCallManager.startProximitySensor();
    } else {
      InCallManager.setKeepScreenOn(true);
      InCallManager.stopProximitySensor();
    }

    setCurrentMediaType(mediaType);
  }, []);

  // ------------------ Audio Routing ------------------

  const enableSpeaker = useCallback(() => {
    InCallManager.setSpeakerphoneOn(true);
    setIsSpeakerOn(true);
  }, []);

  const disableSpeaker = useCallback(() => {
    InCallManager.setSpeakerphoneOn(false);
    setIsSpeakerOn(false);
  }, []);

  const toggleSpeaker = useCallback(() => {
    if (isSpeakerOn) disableSpeaker();
    else enableSpeaker();
  }, [isSpeakerOn]);

  // ------------------ Microphone ------------------

  const muteMicrophone = useCallback(() => {
    InCallManager.setMicrophoneMute(true);
    setIsMuted(true);
  }, []);

  const unmuteMicrophone = useCallback(() => {
    InCallManager.setMicrophoneMute(false);
    setIsMuted(false);
  }, []);

  const toggleMicrophoneMute = useCallback(() => {
    if (isMuted) unmuteMicrophone();
    else muteMicrophone();
  }, [isMuted]);

  // ------------------ Tones ------------------

  const startRingtone = useCallback(async (type: string = '_DEFAULT_') => {
    const ringTime = 30; // total time in seconds
    // todo: write a smaller nativmodule for it.
    const ringerMode = await getRingerMode();

    let vibrationPattern = [
      0,
      ...Array(ringTime * 2).fill(1000), // vibrate 1s, wait 1s -> 30s total
    ];

    if (ringerMode !== undefined && ringerMode === RINGER_MODE.silent) {
      vibrationPattern = [1];
    }
    InCallManager.startRingtone(type, vibrationPattern, 'ringtone', ringTime);
  }, []);

  const stopRingtone = useCallback(() => {
    InCallManager.stopRingtone();
  }, []);

  // not workging ::==>> moved to startCallsession
  const startRingback = useCallback((type: string = '_DEFAULT_') => {
    // InCallManager.startRingback(type);
  }, []);

  const stopRingback = useCallback(() => {
    InCallManager.stopRingback();
  }, []);

  // ------------------ Screen & Proximity ------------------

  const turnScreenOff = useCallback(() => {
    InCallManager.turnScreenOff();
  }, []);

  const turnScreenOn = useCallback(() => {
    InCallManager.turnScreenOn();
  }, []);

  const setKeepScreenOn = useCallback((flag: boolean) => {
    InCallManager.setKeepScreenOn(flag);
  }, []);

  const onProximityChange = useCallback((callback?: (isNear: boolean) => void) => {
    proximityListener.current = DeviceEventEmitter.addListener(
      'Proximity',
      (data: { isNear: boolean }) => {
        setProximityState(data.isNear);
        callback?.(data.isNear);
      },
    );
  }, []);

  // ------------------ Headset & Audio Events ------------------

  const onWiredHeadsetChange = useCallback((callback?: (data: WiredHeadsetData) => void) => {
    headsetListener.current = DeviceEventEmitter.addListener(
      'WiredHeadset',
      (data: WiredHeadsetData) => {
        setHasHeadsetPluggedIn(data.isPlugged);
        callback?.(data);
      },
    );
  }, []);

  const onAudioFocusChange = useCallback((callback: (data: any) => void) => {
    audioFocusListener.current = DeviceEventEmitter.addListener('onAudioFocusChange', callback);
  }, []);

  const onNoisyAudio = useCallback((callback: (data: any) => void) => {
    noisyAudioListener.current = DeviceEventEmitter.addListener('NoisyAudio', callback);
  }, []);

  // ------------------ Cleanup ------------------

  useEffect(() => {
    return () => {
      proximityListener.current?.remove();
      headsetListener.current?.remove();
      audioFocusListener.current?.remove();
      noisyAudioListener.current?.remove();
    };
  }, []);

  useEffect(() => {
    InCallManager.stop();
    InCallManager.stopProximitySensor();
  }, []);

  return {
    // States
    isSpeakerOn,
    isMuted,
    isCallActive,
    proximityState,
    hasHeadsetPluggedIn,
    currentMediaType,

    // Call session
    startCallSession,
    stopCallSession,
    toggleMediaType,

    // Audio routing
    enableSpeaker,
    disableSpeaker,
    toggleSpeaker,

    // Mic
    muteMicrophone,
    unmuteMicrophone,
    toggleMicrophoneMute,

    // Tones
    startRingtone,
    stopRingtone,
    startRingback,
    stopRingback,

    // Proximity & screen
    turnScreenOff,
    turnScreenOn,
    setKeepScreenOn,
    onProximityChange,

    // Events
    onWiredHeadsetChange,
    onAudioFocusChange,
    onNoisyAudio,
  };
}
