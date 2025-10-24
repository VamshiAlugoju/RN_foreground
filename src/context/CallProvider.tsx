import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  useRef,
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
import { Alert, PermissionsAndroid, ToastAndroid, Platform } from 'react-native';

import { generateUUID } from '../utils/commonFunction';
import {
  requestCameraPermission,
  requestMicrophonePermission,
  requestNotificationPermission,
} from '../utils/permissions';
import { useMe } from '../hooks/util/useMe';
import { Client } from '../lib/Client';

import { getAppLanguage } from '../utils/asyncStorage';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  CallDirection,
  useInCallManager,
} from '../hooks/calls/useInCallManager';

import { IUser } from '../types/user.type';
import { getSocket } from '../socket-client/socket';
import { NativeModules, NativeEventEmitter } from 'react-native';

const { CallService } = NativeModules as {
  CallService?: {
    startForegroundService: (
      callType?: 'outgoing' | 'incoming' | 'ongoing',
      username?: string,
    ) => void;
    stopForegroundService: () => void;
  };
};

const CallsContext = createContext<ICallsContext | undefined>(undefined);

function CallProvider({ children }: { children: React.ReactNode }) {
  const { user: userData, setUser } = useMe();

  const [showFullScreenCall, setShowFullScreenCall] = useState(true);

  const { socket, connectSocket, status } = useSocket();
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

  // Bridge events from native notification actions → JS call handlers
  useEffect(() => {
    if (!CallService) return;
    const callEventEmitter = new NativeEventEmitter(CallService as any);
    const onAccept = callEventEmitter.addListener(
      'CALL_ACCEPTED_FROM_NOTIFICATION',
      () => {
        if (currentCallDetails?.roomId) {
          answerCall({ roomId: currentCallDetails.roomId });
        }
      },
    );
    const onReject = callEventEmitter.addListener(
      'CALL_REJECTED_FROM_NOTIFICATION',
      () => {
        rejectCall();
      },
    );
    const onEnd = callEventEmitter.addListener(
      'CALL_ENDED_FROM_NOTIFICATION',
      () => {
        endCall('ongoing');
      },
    );

    return () => {
      onAccept.remove();
      onReject.remove();
      onEnd.remove();
    };
  }, [currentCallDetails]);

  // Simple connection status check
  const [isConnectionRestored, setIsConnectionRestored] = useState(false);
  const reconnectingRef = useRef(false);
  const latestUserRef = useRef<IUser | null>(null);
  const latestSocketRef = useRef<Socket | null>(null);
  const connectionCheckTimerRef = useRef<any>(null);
  const isConnectionRestoredRef = useRef(false);

  useEffect(() => {
    latestUserRef.current = userData || null;
  }, [userData]);

  useEffect(() => {
    latestSocketRef.current = socket;
  }, [socket]);

  useEffect(() => {
    isConnectionRestoredRef.current = isConnectionRestored;
    if (isConnectionRestored && connectionCheckTimerRef.current) {
      clearTimeout(connectionCheckTimerRef.current);
      connectionCheckTimerRef.current = null;
    }
  }, [isConnectionRestored]);

  // If a call is active and user is known, ensure socket reconnects after app recreation
  useEffect(() => {
    const state = callDetailsRef.current?.state || currentCallDetails?.state;
    if (
      (state === 'ongoing' || state === 'outgoing') &&
      userData &&
      !socket.connected &&
      !reconnectingRef.current
    ) {
      reconnectingRef.current = true;
      console.log('Reconnecting socket due to active call and available user...');
      connectSocket(userData)
        .then(() => {
          console.log('Socket reconnected (active call context)');
          setIsConnectionRestored(true);
        })
        .catch(err => {
          console.log('Socket reconnection failed (active call context):', err);
        })
        .finally(() => {
          reconnectingRef.current = false;
        });
    }
  }, [userData, socket.connected, currentCallDetails?.state]);


  // Check for ongoing calls when app starts
  useEffect(() => {
    // Proactively request essential permissions on Android
    const requestEssentialPermissions = async () => {
      // Request notification permission on Android 13+
      await requestNotificationPermission();
      
      // Request microphone permission (essential for calling app)
      await requestMicrophonePermission();
    };
    
    requestEssentialPermissions();

    const checkForOngoingCall = async () => {
      try {
        const savedCall = await AsyncStorage.getItem('ongoingCall');
        if (savedCall) {
          const callData = JSON.parse(savedCall);
          console.log('Found persisted call state:', callData);
          
          // Check if call is recent (within last 5 minutes)
          const isRecent = Date.now() - callData.timestamp < 5 * 60 * 1000;
          if (isRecent) {
            console.log('Original saved state:', callData.state);
            console.log('Forcing to ongoing state for both devices');
            console.log('Restored participants:', callData.participants);
            console.log('Restored recipients:', callData.recipients);
            console.log('Restored recipentList:', callData.recipientList);
            
            // Create participants from recipient data if participants is empty
            let participants = callData.participants || [];
            console.log('Participants length:', participants.length);
            console.log('RecipientList length:', callData.recipientList?.length);
            console.log('Recipients length:', callData.recipients?.length);
            
            if (participants.length === 0) {
              // Try recipientList first, then fallback to recipients
              if (callData.recipientList && callData.recipientList.length > 0) {
                console.log('Creating participants from recipientList');
                participants = callData.recipientList.map((recipient: any) => ({
                  userId: recipient._id,
                  participantId: recipient._id,
                  audioConsumer: null,
                  videoConsumer: null,
                  client: {
                    id: recipient._id,
                    name: recipient.name,
                    username: recipient.username,
                    image: recipient.image,
                  },
                  isScreenSharing: false,
                  isVideoPaused: false,
                  isAudioPaused: false,
                  isAudioMutedByHost: false,
                  isVideoMutedByHost: false,
                  participantContact: null,
                }));
              } else if (callData.recipients && callData.recipients.length > 0) {
                console.log('Creating participants from recipients (fallback)');
                participants = callData.recipients.map((recipient: any) => ({
                  userId: recipient.id,
                  participantId: recipient.id,
                  audioConsumer: null,
                  videoConsumer: null,
                  client: {
                    id: recipient.id,
                    name: recipient.name,
                    username: recipient.username,
                    image: recipient.profilePic || '',
                  },
                  isScreenSharing: false,
                  isVideoPaused: false,
                  isAudioPaused: false,
                  isAudioMutedByHost: false,
                  isVideoMutedByHost: false,
                  participantContact: null,
                }));
              }
            }
            
            // Force both devices to ongoing state for consistent UI
            setCurrentCallDetails(prev => ({
              ...prev,
              state: 'ongoing', // Both devices show ongoing call UI
              clientCallId: callData.clientCallId,
              type: callData.callType,
              roomId: callData.roomId,
              callId: callData.callId,
              initiatorId: callData.initiatorId,
              startedAt: new Date(callData.timestamp),
              // Add missing fields for proper UI display
              recipients: callData.recipients || [],
              recipentList: callData.recipientList || [],
              isGroupCall: callData.recipients ? callData.recipients.length > 1 : false,
              participants: participants,
            }));
            setShowFullScreenCall(true);
            
            // Ensure foreground service is running after restoring call
            try {
              const username = callData?.initiatorDetails?.name || '';
              CallService?.startForegroundService?.('ongoing', username);
            } catch (e) {
              console.log('Failed to start foreground service on restore:', e);
            }
            
            // Attempt immediate socket reconnection if needed
            try {
              if (userData && !socket.connected) {
                console.log('Immediate socket reconnect after call restore...');
                await connectSocket(userData);
                setIsConnectionRestored(true);
              } else if (!userData && !socket.connected) {
                // If user data isn't yet in context, try to load from storage and reconnect
                console.log('Loading stored user for reconnection...');
                const storedUser = await Client.User.get();
                if (storedUser) {
                  try {
                    await setUser(storedUser);
                  } catch {}
                  await connectSocket(storedUser);
                  setIsConnectionRestored(true);
                } else {
                  console.log('No stored user found; socket reconnection will be deferred.');
                }
              }
            } catch (e) {
              console.log('Immediate socket reconnect failed:', e);
            }
            
            // Start monitoring connection restoration and reconnect socket if needed
            const checkConnection = () => {
              const hasUser = !!latestUserRef.current;
              const isConnected = !!latestSocketRef.current?.connected;
              if (hasUser && isConnected) {
                console.log('Connection restored! User data and socket are available');
                setIsConnectionRestored(true);
              } else {
                console.log('Waiting for connection... User data:', hasUser, 'Socket connected:', isConnected);
                
                // If we have user data but no socket connection, try to reconnect once per cycle
                if (hasUser && !isConnected && !reconnectingRef.current) {
                  reconnectingRef.current = true;
                  console.log('Attempting socket reconnection...');
                  connectSocket(latestUserRef.current as IUser)
                    .then(() => {
                      console.log('Socket reconnected successfully');
                      setIsConnectionRestored(true);
                    })
                    .catch(err => {
                      console.log('Socket reconnection failed:', err);
                    })
                    .finally(() => {
                      reconnectingRef.current = false;
                    });
                }
                
                if (!isConnectionRestoredRef.current) {
                  connectionCheckTimerRef.current = setTimeout(checkConnection, 2000); // Check every 2 seconds
                }
              }
            };
            
            // Start checking after a short delay
            connectionCheckTimerRef.current = setTimeout(checkConnection, 1000);
            
          } else {
            // Call is too old, clear it
            await AsyncStorage.removeItem('ongoingCall');
          }
        }
      } catch (e) {
        console.log('Error checking for ongoing call:', e);
      }
    };

    checkForOngoingCall();
  }, []);

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
      
      // Start foreground service when call begins
      try {
        // Prefer recipient name for better UX
        const primaryRecipient = recipentList?.[0]?.name || recipients?.[0]?.name || '';
        CallService?.startForegroundService?.('outgoing', primaryRecipient);
        // Save call state to persist across app restarts
        await AsyncStorage.setItem('ongoingCall', JSON.stringify({
          state: 'outgoing',
          clientCallId,
          callType,
          recipients: recipients.map(r => r.id),
          recipentList: recipentList,
          timestamp: Date.now()
        }));
      } catch (e) {
        console.log('Failed to start foreground service:', e);
      }
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
  async function endCall(context?: 'outgoing' | 'ongoing', retryCount: number = 0) {
    try {
      console.log('endCall called with context:', context, 'retryCount:', retryCount);
      const callDetails = getCallDetails();
      console.log('Call details in endCall:', callDetails);
      console.log('User data in endCall:', userData);
      console.log('Socket in endCall:', socket);
      
      if (!callDetails) {
        console.log('endCall: Missing callDetails, returning early');
        return;
      }
      
      if (!userData && retryCount < 3) {
        console.log('endCall: User data not loaded yet, waiting... (retry', retryCount + 1, '/3)');
        // Wait a bit for user data to load, then retry
        setTimeout(() => {
          console.log('endCall: Retrying after user data load');
          endCall(context, retryCount + 1);
        }, 1000);
        return;
      }
      
      if (!userData && retryCount >= 3) {
        console.log('endCall: User data still not loaded after 3 retries, cannot end call');
        console.log('EndCall button disabled - no server connection available');
        if (isConnectionRestored) {
          ToastAndroid.show('Connection restored! EndCall button should work now.', ToastAndroid.SHORT);
        } else {
          ToastAndroid.show('Cannot end call - no connection to server. Please wait for connection to restore.', ToastAndroid.LONG);
        }
        return;
      }
      // setShowFullScreenCall(false);
      if (callDetails.state === 'idle') {
        return;
      }

      // Ensure socket is connected before emitting termination events
      if (!socket.connected && userData && !reconnectingRef.current) {
        try {
          reconnectingRef.current = true;
          console.log('endCall: Socket not connected, attempting quick reconnect...');
          await connectSocket(userData);
          console.log('endCall: Reconnect success');
        } catch (e) {
          console.log('endCall: Reconnect failed, proceeding with local cleanup:', e);
        } finally {
          reconnectingRef.current = false;
        }
      }

      console.log('Socket connected:', socket.connected);
      console.log('Initiator ID:', callDetails.initiatorId);
      const currentUser = userData as IUser;
      console.log('User ID:', currentUser.id);
      
      // Log who is ending the call
      const isInitiator = callDetails.initiatorId === currentUser.id;
      console.log(`[CALLER] endCall triggered by ${isInitiator ? 'CALLER (initiator)' : 'RECEIVER (participant)'}`);
      console.log(`[CALLER] Call details:`, {
        callId: callDetails.callId,
        roomId: callDetails.roomId,
        initiatorId: callDetails.initiatorId,
        currentUserId: currentUser.id,
        state: callDetails.state,
      });
      
      if (callDetails.initiatorId === currentUser.id) {
        console.log('[CALLER] User is call initiator, emitting END_CALL event (original working version)');
        socket.emit(callSocketEvents.END_CALL, {
          callId: callDetails.callId,
          clientId: currentUser.id,
          roomId: callDetails.roomId,
        });
        console.log('[CALLER] END_CALL emitted immediately (original working behavior)');
        
      } else if (callDetails.roomId && callDetails.roomId) {
        console.log('[RECEIVER] User is participant, emitting LEAVE_CALL event');
        socket.emit(callSocketEvents.LEAVE_CALL, {
          callId: callDetails.callId,
          clientId: currentUser.id,
          roomId: callDetails.roomId,
        });
        console.log('[RECEIVER] LEAVE_CALL emitted immediately (no delay - original behavior)');
      }

      if (context === 'outgoing') {
        console.log('[CALLER/RECEIVER] Context is "outgoing", emitting END_OUTGOING_CALL');
        socket.emit(
          callSocketEvents.END_OUTGOING_CALL,
          {
            clientCallId: callDetails.clientCallId,
          },
          (resp: any) => {
            console.log('[CALLER/RECEIVER] END_OUTGOING_CALL response:', resp);
          },
        );
      }

      // ✅ Now safe to cleanup - socket events have been transmitted
      console.log('[CALLER/RECEIVER] Starting local cleanup...');
      console.log('[CALLER/RECEIVER] Step 1: Resetting call details');
      resetCallDetails();

      console.log('[CALLER/RECEIVER] Step 2: Removing media device');
      removeDevice();

      console.log('[CALLER/RECEIVER] Step 3: Resetting auto-end timer');
      resetAutoEndTimer();

      console.log('[CALLER/RECEIVER] Step 4: Stopping media producers');
      mediaProducers.stopProducing();

      console.log('[CALLER/RECEIVER] Step 5: Closing notifications');
      closeNotifications();

      console.log('[CALLER/RECEIVER] Step 6: Resetting keep-alive timer');
      resetKeepCallAliveTimer();

      // Stop foreground service when call ends
      console.log('[CALLER/RECEIVER] Step 7: Stopping foreground service');
      try {
        CallService?.stopForegroundService?.();
        console.log('[CALLER/RECEIVER] ✅ Foreground service stopped');
        await AsyncStorage.removeItem('ongoingCall');
        console.log('[CALLER/RECEIVER] ✅ AsyncStorage cleared');
      } catch (e) {
        console.log('[CALLER/RECEIVER] ❌ Failed to stop foreground service:', e);
      }

      console.log('[CALLER/RECEIVER] ✅ Call termination complete on caller/receiver side');
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
        
        // Ensure service is running when call becomes active
        try {
          const username = currentCallDetails?.recipients?.[0]?.name || '';
          CallService?.startForegroundService?.('ongoing', username);
        } catch (e) {
          console.log('Failed to start foreground service on answer:', e);
        }
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

        // Update persisted call state after participants are created
        try {
          const callDetailsForPersistence = getCallDetails();
          await AsyncStorage.setItem('ongoingCall', JSON.stringify({
            state: 'ongoing',
            roomId,
            callId,
            callType,
            initiatorId: data.initiatorId,
            recipients: callDetailsForPersistence?.recipients || [],
            recipentList: callDetailsForPersistence?.recipentList || [],
            participants: newPartcipants,
            timestamp: Date.now()
          }));
        } catch (e) {
          console.log('Failed to save call state:', e);
        }

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
    try {
      CallService?.stopForegroundService?.();
    } catch (e) {
      console.log('Failed to stop foreground service on reject:', e);
    }
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
        // Stop foreground service and clear persisted state on single-recipient rejection
        try {
          CallService?.stopForegroundService?.();
          await AsyncStorage.removeItem('ongoingCall');
        } catch (e) {
          console.log('Failed to stop foreground service on rejection:', e);
        }
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
      
      // Ensure caller's notification reflects ongoing state
      try {
          const username = currentCallDetails?.recipients?.[0]?.name || '';
          CallService?.startForegroundService?.('ongoing', username);
      } catch (e) {
        console.log('Failed to update foreground notification on answer:', e);
      }
      
      // Save call state when call is answered (caller side)
      try {
        const callDetailsForPersistence = getCallDetails();
        await AsyncStorage.setItem('ongoingCall', JSON.stringify({
          state: 'ongoing',
          roomId: callDetailsForPersistence?.roomId,
          callId: callDetailsForPersistence?.callId,
          callType: callDetailsForPersistence?.type,
          initiatorId: callDetailsForPersistence?.initiatorId,
          recipients: callDetailsForPersistence?.recipients || [],
          recipentList: callDetailsForPersistence?.recipentList || [],
          participants: callDetailsForPersistence?.participants || [],
          timestamp: Date.now()
        }));
      } catch (e) {
        console.log('Failed to save call state on answer:', e);
      }
      
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
    
    // If call is already ended locally, just return silently
    if (!callDetails || callDetails.state == 'idle') {
      console.log('[RECEIVER] Call already ended locally, ignoring termination event');
      return;
    }
    if (callDetails.roomId !== data.roomId) {
      console.log('[RECEIVER] Room ID mismatch, ignoring termination event:', {
        receivedRoomId: data.roomId,
        currentRoomId: callDetails.roomId,
      });
      // ToastAndroid.show(`call with roomId ${data.roomId} terminated`, ToastAndroid.SHORT);
      return;
    }
    
    console.log('[RECEIVER] ✅ Call termination event matches current call, proceeding with cleanup');
    // toast(`Call Terminated by ${data.callId}`);
    if (message) {
      console.log('[RECEIVER] Displaying termination message:', message);
      ToastAndroid.show(message, ToastAndroid.SHORT);
    }

    console.log('[RECEIVER] Starting cleanup after receiving termination event...');
    
    console.log('[RECEIVER] Step 1: Resetting call details');
    resetCallDetails();
    
    console.log('[RECEIVER] Step 2: Stopping media producers');
    mediaProducers.stopProducing();

    console.log('[RECEIVER] Step 3: Removing media device');
    removeDevice();

    console.log('[RECEIVER] Step 4: Hiding call notifications');
    hideCallNotification('showReconnectCallPopup');
    
    console.log('[RECEIVER] Step 5: Resetting keep-alive timer');
    resetKeepCallAliveTimer();
    
    console.log('[RECEIVER] Step 6: Going back from main call screen');
    goBackFromMainCallScreen(setShowFullScreenCall);
    
    // Stop service and clear persisted state on remote termination
    console.log('[RECEIVER] Step 7: Stopping foreground service');
    try {
      CallService?.stopForegroundService?.();
      console.log('[RECEIVER] ✅ Foreground service stopped');
      await AsyncStorage.removeItem('ongoingCall');
      console.log('[RECEIVER] ✅ AsyncStorage cleared');
    } catch (e) {
      console.log('[RECEIVER] ❌ Failed to stop foreground service on remote terminate:', e);
    }
    
    console.log('[RECEIVER] ✅ Call termination complete on receiver side');
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
    try {
      CallService?.stopForegroundService?.();
    } catch (e) {
      console.log('Failed to stop foreground service on ignore:', e);
    }
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
    // Show incoming call notification before user answers
    try {
      const username = data?.initiatorDetails?.name || '';
      CallService?.startForegroundService?.('incoming', username);
    } catch (e) {
      console.log('Failed to start incoming call foreground notification:', e);
    }
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
    // Check if microphone permission is already granted (don't request again)
    if (Platform.OS === 'android') {
      const micPermission = await PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.RECORD_AUDIO);
      if (!micPermission) {
        ToastAndroid.show('Microphone permission is required for calls', ToastAndroid.SHORT);
        return false;
      }
    }
    
    if (props.callType === 'video') {
      if (Platform.OS === 'android') {
        const cameraPermission = await PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.CAMERA);
        if (!cameraPermission) {
          ToastAndroid.show('Camera permission is required for video calls', ToastAndroid.SHORT);
          return false;
        }
      }
    }
    return true;
  } catch (err) {
    console.error('Error checking permissions:', err);
    return false;
  }
}
