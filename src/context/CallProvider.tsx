import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react';
import { useMediasoup } from './RtcProvider';
import {
  answerCallRes,
  ICallsContext,
  incomingCallData,
  Participant,
  StartCallParams,
  StartCallRes,
  removeParticipantResponse,
  RecipientDetail,
  userIsOnOtherCallType,
  CallDetails,
  IgnoreCallPayload,
  CallTranslationContext,
} from '../types/calls.types';

import useCallSocketListeners, {
  ToggleAudioPayload,
  ToggleAudioResponse,
} from '../hooks/calls/useCallSocketListeners';
import useCallNotifications from '../hooks/calls/useCallNotifications';
import { Socket } from 'socket.io-client';

import useSocket from '../socket-client/useSocket';
import useCallState from '../hooks/calls/useCallState';
import { callSocketEvents } from '../socket-client/socketEvents';
import { Alert, PermissionsAndroid, ToastAndroid } from 'react-native';

import { generateUUID } from '../utils/commonFunction';
import {
  requestCameraPermission,
  requestMicrophonePermission,
} from '../utils/usePermission';
import { useMe } from '../hooks/util/useMe';

import { getAppLanguage } from '../utils/asyncStorage';
import {
  CallDirection,
  useInCallManager,
} from '../hooks/calls/useInCallManager';

import { IUser } from '../types/user.type';
import { getSocket } from '../socket-client/socket';

const CallsContext = createContext<ICallsContext | undefined>(undefined);

function CallProvider({ children }: { children: React.ReactNode }) {
  const { user: userData } = useMe();

  const [showFullScreenCall, setShowFullScreenCall] = useState(true);

  const { socket } = useSocket();
  const {
    currentCallDetails,
    callDetailsRef,
    setCurrentCallDetails,
    resetCallDetails,
    updateCallDetails,
    getCallDetails,
    getParticipants,
  } = useCallState();

  const { mediaConsumers, mediaDevice, mediaProducers, removeDevice } =
    useMediasoup();
  useCallSocketListeners({
    socket,
    onIncomingCall, // handle incoming call
    handleUserAnswered, // when user answered this will be emitted
    handleCallTerminated, // when the call is closed.(due to any reason)
    handleUserLeftCall, // when a user left from the group call
    onSwitchToVideo, // when a user in the call sent an intent to turn the audio call to video
    handleToggleAudio, // when someone muted or unmuted their audio
    handleToggleVideo, // when someone is toggled their video
    haddleNewProducer, // when a new participant started producing their stream
    onCallRejected, // when someone rejected the call;
    onSwitchToVideoAccepted, // when your intent to switch to video call is accepted by atleast one user;
    onSwitchToVideoRejected, // when your intent to switch to video call is rejected by atleast one user;
    // onParticipantRemovedFromCall, // this will be emitted when a user is removed from the call by admin;
    // onYouAreRemovedFromCall, // emitted when you have been removed from the call;
    // onUserIsOnOtherCall,

    onCallIgnored, //when any recipient ignored the call;
    // onTerminateTranslation, // translation
    // handleUserAudioToggled,
    // onSwitchToVideoCall,
  });

  const {
    callNotifications,
    closeNotifications,

    startIncomingCallTimer,
    timerRefs,
    resetAutoEndTimer,
    startAutoEndTimer,
    showCallNotification,
    hideCallNotification,
    startKeepCallAliveTimer,
    resetKeepCallAliveTimer,
  } = useCallNotifications();

  const inCallController = useInCallManager();

  const startCall = useCallback(
    async (params: StartCallParams) => {
      if (!userData) return;
      const hasPermissions = await getCallPermissions(params);
      if (!hasPermissions) {
        ToastAndroid.show(
          'Permissions denied to start call',
          ToastAndroid.SHORT,
        );
        return;
      }
      const currentCallDetails = getCallDetails();
      if (currentCallDetails && currentCallDetails.state !== 'idle') {
        ToastAndroid.show('You are busy with another call', ToastAndroid.SHORT);
        return;
      }
      const { recipients, callType, origin } = params;

      const recipentList: RecipientDetail[] = recipients.map(item => {
        return {
          _id: item.id || '',
          name: item.name || '',
          image: item.profilePic || '',
          username: item.username || '',
          email: '',
        };
      });

      const clientCallId = generateUUID(30);
      // pre initialising the call state for the UI.
      setCurrentCallDetails(prev => ({
        ...prev,
        state: 'outgoing',
        recipentList: recipentList,
        origin: origin,
        clientCallId,
        type: callType,
      }));
      const payload = {
        callerId: userData.id,
        recipients: recipients.map(r => r.id),
        call_type: callType,
        origin: origin,
        clientCallId: clientCallId,
      };

      socket.emit(
        callSocketEvents.START_CALL,
        payload,
        async (data: StartCallRes) => {
          if (data.error) {
            ToastAndroid.show(data.error, ToastAndroid.SHORT);
            const calldetaisl = getCallDetails();
            if (calldetaisl?.state === 'outgoing') {
              resetCallDetails();
              // setShowFullScreenCall(prev => false);
              return;
            }
          }
          const { callId, roomId, initiatorId, recipentList, rtpCapabilities } =
            data;
          if (origin && origin.type === 'groupConversation') {
          }

          await mediaDevice.initializeDevice(roomId, rtpCapabilities);
          await mediaProducers.createProducerTransport(roomId, callType);
          await mediaConsumers.createConsumerTransport(roomId);

          setCurrentCallDetails(prev => ({
            ...prev,
            callId,
            roomId,
            recipients,
            initiatorId: userData.id,
            initialCallType: callType,
            isGroupCall: recipients.length > 1,
            participants: [],
            state: 'outgoing',
            startedAt: new Date(),
            type: callType,
            recipentList,
          }));
          // startKeepCallAliveTimer(sendCallHeartBeat);
          startAutoEndTimer(() => {
            endCall();
          }, 30 * 1000);
        },
      );
    },
    [
      userData,
      socket,
      mediaDevice,
      mediaProducers,
      mediaConsumers,
      setCurrentCallDetails,
      startAutoEndTimer,
      endCall,
    ],
  );

  /**
   * Ends the call
   */
  async function endCall(context?: 'outgoing' | 'ongoing') {
    try {
      const callDetails = getCallDetails();
      if (!callDetails || !userData) {
        return;
      }
      // setShowFullScreenCall(false);
      if (callDetails.state === 'idle') {
        return;
      }

      if (callDetails.initiatorId === userData.id) {
        socket.emit(callSocketEvents.END_CALL, {
          callId: callDetails.callId,
          clientId: userData.id,
          roomId: callDetails.roomId,
        });
      } else if (callDetails.roomId && callDetails.roomId) {
        socket.emit(callSocketEvents.LEAVE_CALL, {
          callId: callDetails.callId,
          clientId: userData.id,
          roomId: callDetails.roomId,
        });
      }

      if (context === 'outgoing') {
        socket.emit(
          callSocketEvents.END_OUTGOING_CALL,
          {
            clientCallId: callDetails.clientCallId,
          },
          (resp: any) => {
            console.log('end outgoing call response', resp);
          },
        );
      }

      resetCallDetails();
      removeDevice();
      resetAutoEndTimer();
      mediaProducers.stopProducing();
      closeNotifications();
      resetKeepCallAliveTimer();
      // goBackFromMainCallScreen(setShowFullScreenCall);
    } catch (err) {
      console.error(err);
    }
  }

  async function cancelCall() {
    const callDetails = callDetailsRef.current;
    if (!callDetails || !userData) {
      return;
    }
    socket.emit(callSocketEvents.CANCEL_CALL, {
      callId: callDetails.callId,
      clientId: userData.id,
      roomId: callDetails.roomId,
    });
  }

  function answerCall({ roomId }: { roomId: string }) {
    setShowFullScreenCall(true);
    socket.emit(
      callSocketEvents.ANSWER_CALL,
      { roomId: roomId },
      async (data: answerCallRes) => {
        if (!userData) {
          throw new Error('user not found, cannot make call ');
        }
        const {
          roomId,
          producers,
          rtpCapabilites,
          callType,
          callId,
          initialPartcipants,
        } = data;
        setCurrentCallDetails(prev => {
          return {
            ...prev,
            state: 'ongoing',
            initiatorId: data.initiatorId,
            roomId,
            startedAt: new Date(),
          };
        });
        const device = await mediaDevice.initializeDevice(
          roomId,
          rtpCapabilites,
        );
        await Promise.all([
          mediaProducers.createProducerTransport(roomId, callType),
          mediaConsumers.createConsumerTransport(roomId),
        ]);

        socket.emit(callSocketEvents.NOTIFY_OWNER, {
          roomId,
          callId,
          clientId: userData.id,
        });
        const newPartcipants = initialPartcipants.map(item => {
          const newParticipant: Participant = {
            userId: item.userId,
            participantId: item.participantId,
            audioConsumer: null,
            videoConsumer: null,
            client: item.client,
            isScreenSharing: item.isScreenSharing,
            isVideoPaused: false,
            isAudioPaused: false,
            isAudioMutedByHost: false,
            isVideoMutedByHost: false,
            participantContact: null,
          };
          return newParticipant;
        });
        mediaConsumers.setRemoteVideoData(prev => {
          return [...prev, ...newPartcipants];
        });

        if (producers && producers.length > 0) {
          producers.forEach(async (producer: any) => {
            await mediaConsumers.consume(
              producer.id,
              roomId,
              producer.producerClientId,
              device,
              producer.isScreenSharer ? producer.isScreenSharer : false,
            );
          });
        }

        //write to realm db
      },
    );
  }
  function rejectCall() {
    const callDetails = callDetailsRef.current;
    if (!callDetails || !userData) {
      return;
    }
    socket.emit(callSocketEvents.REJECT_CALL, {
      callId: callDetails.callId,
      clientId: userData.id,
      roomId: callDetails.roomId,
    });

    resetCallDetails();
    goBackFromMainCallScreen(setShowFullScreenCall);
  }

  async function onCallRejected(data: { userId: string }) {
    try {
      const { userId } = data;
      // end the call if the call is not group call

      const callDetails = getCallDetails();
      if (!callDetails) return;

      const rejectedRecipient =
        callDetails.recipients.find(({ userId: _id }) => _id === userId)
          ?.name ?? userId;

      // const contact = await getContactByUserId(userId);
      if (
        callDetails.state === 'outgoing' &&
        callDetails.recipients.length <= 1
      ) {
        resetCallDetails();
        resetAutoEndTimer();
        resetKeepCallAliveTimer();
        goBackFromMainCallScreen(setShowFullScreenCall);
        ToastAndroid.show(
          `${rejectedRecipient} rejected the call`,
          ToastAndroid.SHORT,
        );
        await mediaProducers.stopProducing();
        return;
      }
      ToastAndroid.show(
        `${rejectedRecipient} rejected the call`,
        ToastAndroid.SHORT,
      );
    } catch (err) {
      console.log(err, '>>>>>>>>>>>>.. error at onCallRejected');
    }
  }

  function muteCall() {}

  async function onSwitchToVideo(data: any) {
    timerRefs.current.showSwitchToVideoTimer != null &&
      clearTimeout(timerRefs.current.showSwitchToVideoTimer);

    showCallNotification('showSwitchToVideoPopup');

    timerRefs.current.showSwitchToVideoTimer = setTimeout(() => {
      hideCallNotification('showSwitchToVideoPopup');
    }, 10 * 1000);
  }

  async function onSwitchToVideoAccepted(data: any) {
    updateCallDetails({ type: 'video' });
    await mediaProducers.produceVideo({});
  }
  async function onSwitchToVideoRejected(data: any) {
    Alert.alert('switch to video rejected');
  }

  async function handleUserAnswered() {
    try {
      const currentCallDetails = callDetailsRef.current;
      if (!currentCallDetails) return;
      if (currentCallDetails.state != 'outgoing') {
        return;
      }
      setCurrentCallDetails(prev => {
        return {
          ...prev,
          state: 'ongoing',
          startedAt: new Date(),
        };
      });
      resetAutoEndTimer();
    } catch (err) {
      throw new Error(JSON.stringify(err));
    }
  }

  async function handleCallTerminated(data: {
    callId: string;
    roomId: string;
    message?: string;
  }) {
    const { message = '' } = data;
    const callDetails = callDetailsRef.current;
    if (!callDetails || callDetails.state == 'idle') {
      throw new Error('tried to end the call without the currentCal');
    }
    if (callDetails.roomId !== data.roomId) {
      // ToastAndroid.show(`call with roomId ${data.roomId} terminated`, ToastAndroid.SHORT);
      return;
    }
    // toast(`Call Terminated by ${data.callId}`);
    if (message) {
      ToastAndroid.show(message, ToastAndroid.SHORT);
    }

    resetCallDetails();
    mediaProducers.stopProducing();

    removeDevice();

    hideCallNotification('showReconnectCallPopup');
    resetKeepCallAliveTimer();
    goBackFromMainCallScreen(setShowFullScreenCall);
  }
  async function handleUserLeftCall(data: {
    callId: string;
    participantId: string;
    roomId: string;
    isSharingScreen?: boolean;
    userId: string;
  }) {
    mediaConsumers.removeRemoteVideo({
      participantId: data.participantId,
      isSharingScreen: data.isSharingScreen ? data.isSharingScreen : false,
      userId: data.userId,
    });
  }

  async function haddleNewProducer(data: any) {
    try {
      const {
        producerId,
        kind,
        roomId,
        callType,
        rtpCapabilites,
        clientId,
        isScreenSharing,
      } = data;

      console.log('haddle new producer', producerId, clientId, isScreenSharing);

      const device = mediaDevice.getDevice();
      let prevDevice = device;
      if (!device) {
        prevDevice = await mediaDevice.initializeDevice(roomId, rtpCapabilites);
      }
      mediaConsumers.consume(
        producerId,
        roomId,
        clientId,
        prevDevice!,
        isScreenSharing,
      );
    } catch (err) {
      throw new Error('error when handling new producer');
    }
  }

  // 🛎️ Incoming & Admin:

  function ignoreCall() {
    const currentCallDetails = callDetailsRef.current;
    if (currentCallDetails?.state != 'incoming') {
      return;
    }
    socket.emit(callSocketEvents.CALL_IGNORED, {
      callId: currentCallDetails.callId,
      roomId: currentCallDetails.roomId,
    });
    resetCallDetails();
    goBackFromMainCallScreen(setShowFullScreenCall);
  }

  function onIncomingCall(data: incomingCallData) {
    // setShowFullScreenCall(prev => false);
    setCurrentCallDetails(prev => {
      const {
        callType = prev.type,
        recipents = prev.recipients,
        callId = prev.callId,
        initialCallType = prev.initialCallType,
        isGroupCall = prev.isGroupCall,
        roomId = prev.roomId,
        recipentList = prev.recipentList,
        origin = prev.origin,
        initiatorDetails,
        initiatorId,
      } = data;
      const updateObj: CallDetails = {
        ...prev,
        state: 'incoming',
        startedAt: new Date(),
        type: callType,
        recipients: recipents,
        callId: callId,
        initialCallType: initialCallType,
        isGroupCall: isGroupCall,
        roomId: roomId,
        recipentList: recipentList,
        origin: origin,
        initiatorDetails: initiatorDetails,
        initiatorId: initiatorId,
        initiatorContact: null,
      };
      callDetailsRef.current = updateObj;
      return updateObj;
    });

    startIncomingCallTimer(ignoreCall);
  }

  //🔊 Media/AV Controls:
  function handleToggleAudio(data: ToggleAudioPayload) {}
  type ToggleVideoPayload = {
    callId: string;
    clientId: string;
    muted: boolean;
    roomId: string;
    videoEnabled: boolean;
    participantId: string;
  };
  function handleToggleVideo(data: ToggleVideoPayload) {}

  async function onCallIgnored(payload: IgnoreCallPayload) {
    const callDetails = getCallDetails();
    const { roomId, userId } = payload;
    if (!callDetails || callDetails.roomId !== roomId) {
      console.error('Error::call not found');
      return;
    }

    const rejectedRecipient =
      callDetails.recipients.find(({ userId: _id }) => _id === userId)?.name ??
      userId;
    if (callDetails.recipients.length <= 1) {
      resetCallDetails();
      resetAutoEndTimer();
      resetKeepCallAliveTimer();
      endCall();
      goBackFromMainCallScreen(setShowFullScreenCall);
      ToastAndroid.show(
        `${rejectedRecipient} ignored the call`,
        ToastAndroid.SHORT,
      );
      await mediaProducers.stopProducing();
      return;
    }
  }

  // comment if we work on designs
  useEffect(() => {
    if (mediaConsumers.remoteVideoData)
      setCurrentCallDetails(prev => {
        return {
          ...prev,
          participants: mediaConsumers.remoteVideoData,
        };
      });
  }, [mediaConsumers.remoteVideoData]);

  const contextValues: ICallsContext = {
    callDetails: currentCallDetails,
    getCallDetails,
    startCall,
    rejectCall,
    muteCall,
    answerCall,

    endCall,
    showCallNotification,
    callNotifications,
    hideCallNotification,

    cancelCall,

    producers: mediaProducers.producers,
    resetCallDetails,

    inCallController,
    updateCallDetails,

    showFullScreenCall,
    setShowFullScreenCall,
  };

  return (
    <CallsContext.Provider value={contextValues}>
      {children}
    </CallsContext.Provider>
  );
}

export const useCallContext = () => {
  const context = useContext(CallsContext);
  if (!context) {
    throw new Error('Error while accessing the CallContext');
  }
  return context;
};

export default CallProvider;

// for Ui demo
// useEffect(() => {
//   setInterval(async () => {
//     const mediaStream = await navigator.mediaDevices.getUserMedia({
//       audio: true,
//       video: true,
//     });
//     const audioTrack = mediaStream.getAudioTracks()[0];
//     const videoTrack = mediaStream.getVideoTracks()[0];

//     setCurrentCallDetails((prev) => {
//       if (prev.participants.length === 10) {
//         return prev;
//       }
//       return {
//         ...prev,
//         participants: [
//           ...prev.participants,
//           {
//             id: "user-123",
//             clientId: Math.random().toString(36).substring(2, 15),
//             producerId: "producer-xyz",
//             audioTrack: audioTrack,
//              videoTrack: videoTrack,
//             audioConsumer: null,
//             videoConsumer: null,

//             client: {
//               id: "1",
//               name: Math.random().toString(36).substring(2, 15),
//               username: Math.random().toString(36).substring(2, 15),
//               image: imgUrl,
//             },
//           },
//         ],
//       };
//     });
//   }, 5000);
// }, []);

/* 
endcall
*/

function goBackFromMainCallScreen(
  setShowFullScreenCall: React.Dispatch<React.SetStateAction<boolean>>,
) {
  // setShowFullScreenCall(false);
}

export async function getCallPermissions(props: {
  callType: 'audio' | 'video';
}) {
  try {
    const micPermission = await requestMicrophonePermission();
    if (micPermission !== 'granted') {
      ToastAndroid.show('Microphone permission denied', ToastAndroid.SHORT);
      return false;
    }
    if (props.callType === 'video') {
      let resp = await requestCameraPermission();
      if (resp !== 'granted') {
        ToastAndroid.show('Camera permission denied', ToastAndroid.SHORT);
        return false;
      }
    }
    return true;
  } catch (err) {
    return false;
  }
}
