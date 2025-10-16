import { useEffect } from 'react';
import { Socket } from 'socket.io-client';

import {
  incomingCallData,
  userIsOnOtherCallType,
  IgnoreCallPayload,
  CallTranslationContext,
} from '../../types/calls.types';

import {
  callSocketEvents,
  mediaSocketEvents,
} from '../../socket-client/socketEvents';

interface UseCallSocketListenersProps {
  socket: Socket | undefined;
  onIncomingCall: (data: incomingCallData) => void;
  handleUserAnswered: () => Promise<void>;
  handleCallTerminated: (data: {
    callId: string;
    roomId: string;
  }) => Promise<void>;
  handleUserLeftCall: (data: {
    callId: string;
    participantId: string;
    roomId: string;
    userId: string;
  }) => Promise<void>;
  onSwitchToVideo: (data: any) => void;
  handleToggleAudio: (data: any) => void;
  handleToggleVideo: (data: any) => void;
  haddleNewProducer: (data: any) => Promise<void>;
  onCallRejected: (data: any) => Promise<void>;
  onSwitchToVideoRejected: (data: any) => Promise<void>;
  onSwitchToVideoAccepted: (data: any) => Promise<void>;

  onCallIgnored: (data: IgnoreCallPayload) => void;
}

function useCallSocketListeners({
  socket,
  onIncomingCall,
  handleUserAnswered,
  handleCallTerminated,
  handleUserLeftCall,
  onSwitchToVideo,
  handleToggleAudio,
  handleToggleVideo,
  haddleNewProducer,
  onCallRejected,
  onSwitchToVideoAccepted,
  onSwitchToVideoRejected,

  onCallIgnored,
}: UseCallSocketListenersProps) {
  useEffect(() => {
    if (!socket) {
      return;
    }

    socket.on(callSocketEvents.INCOMING_CALL, onIncomingCall);
    socket.on(callSocketEvents.CALL_ANSWERED, handleUserAnswered);
    socket.on(callSocketEvents.TERMINATE_CALL, handleCallTerminated);
    socket.on(callSocketEvents.USER_LEFT_CALL, handleUserLeftCall);
    socket.on(callSocketEvents.SWITCH_TO_VIDEO, onSwitchToVideo);
    socket.on(callSocketEvents.TOGGLE_AUDIO, handleToggleAudio);
    socket.on(callSocketEvents.TOGGLE_VIDEO, handleToggleVideo);
    socket.on(mediaSocketEvents.NEW_PRODUCER, haddleNewProducer);
    socket.on(callSocketEvents.CALL_REJECTED, onCallRejected);

    socket.on(
      callSocketEvents.SWITCH_TO_VIDEO_ACCEPTED,
      onSwitchToVideoAccepted,
    );
    socket.on(
      callSocketEvents.SWITCH_TO_VIDEO_REJECTED,
      onSwitchToVideoRejected,
    );

    socket.on(callSocketEvents.CALL_IGNORED, onCallIgnored);
    socket.on(callSocketEvents.CALL_ATTEMPT, handleCallAttempt);

    return () => {
      socket.off(callSocketEvents.INCOMING_CALL, onIncomingCall);
      socket.off(callSocketEvents.CALL_ANSWERED, handleUserAnswered);
      socket.off(callSocketEvents.TERMINATE_CALL, handleCallTerminated);
      socket.off(callSocketEvents.USER_LEFT_CALL, handleUserLeftCall);
      socket.off(callSocketEvents.SWITCH_TO_VIDEO, onSwitchToVideo);
      socket.off(callSocketEvents.TOGGLE_AUDIO, handleToggleAudio);
      socket.off(callSocketEvents.TOGGLE_VIDEO, handleToggleVideo);
      socket.off(mediaSocketEvents.NEW_PRODUCER, haddleNewProducer);
      socket.off(callSocketEvents.CALL_REJECTED, onCallRejected);
      socket.off(
        callSocketEvents.SWITCH_TO_VIDEO_ACCEPTED,
        onSwitchToVideoAccepted,
      );
      socket.off(
        callSocketEvents.SWITCH_TO_VIDEO_REJECTED,
        onSwitchToVideoRejected,
      );

      socket.off(callSocketEvents.CALL_IGNORED, onCallIgnored);
      socket.off(callSocketEvents.CALL_ATTEMPT, handleCallAttempt);
    };
  }, [
    socket,
    // onIncomingCall,
    // handleUserAnswered,
    // handleCallTerminated,
    // handleUserLeftCall,
    // onSwitchToVideo,
    // handleToggleAudio,
    // handleToggleVideo,
    // handleScreenShareReq,
    // haddleNewProducer,
    // onCallRejected,
  ]);
}

export default useCallSocketListeners;

function handleCallAttempt(data: incomingCallData) {
  console.log('handleCallAttempt', data);
}

export type ToggleAudioResponse = {
  callId: string;
  clientId: string;
  mute: boolean;
  roomId: string;
  videoEnabled: boolean;
  participentId: string;
  userId: string;
};

export type ToggleAudioPayload = {
  participantId: string;
  userId: string;
  muted: boolean;
};
