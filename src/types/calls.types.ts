import { Device, types } from 'mediasoup-client';
import { Socket } from 'socket.io-client';
import { MediaStream, MediaStreamTrack } from 'react-native-webrtc';
// import { RealmContact } from '../device-storage/realm/schemas/ContactSchema';
import { UseInCallManagerResult } from '../hooks/calls/useInCallManager';

import { IUser } from './user.type';

/**
 * Context interface for call-related operations and state
 * Used by the CallsContext provider to expose all call functionality to the app
 */
export interface ICallsContext {
  callDetails: CallDetails; // Current call information
  getCallDetails: () => CallDetails | null; // Retrieve current call details
  startCall: (params: StartCallParams) => void; // Initiate a new call
  rejectCall: () => void; // Reject an incoming call
  muteCall: () => void; // Mute local audio
  answerCall: ({ roomId }: AnswerCallPayload) => void; // Accept incoming call
  endCall(context?: 'outgoing' | 'ongoing'): Promise<void>;
  callNotifications: callsNotificationType; // UI notifications related to calls
  hideCallNotification: (type: keyof callsNotificationType) => void; // Hide a notification popup
  showCallNotification: (type: keyof callsNotificationType) => void; // Show a notification popup
  cancelCall(): Promise<void>; // Cancel outgoing call before answered

  producers: producerT; // Local media producers (audio/video/screen)
  resetCallDetails: () => void; // Reset call state to initial

  inCallController: UseInCallManagerResult; // Controls audio routing, screen state, etc.
  updateCallDetails: (partialCallDetails: Partial<CallDetails>) => void;

  setShowFullScreenCall: React.Dispatch<React.SetStateAction<boolean>>;
  showFullScreenCall: boolean;
}

/** Payload for answering an incoming call */
export type AnswerCallPayload = {
  roomId: string;
};

/** Group conversation metadata for group calls */
export type GroupConversationDetails = {
  chatSpaceId?: string;
  memberCount?: number;
  displayName: string;
  displayPic?: string;
  id?: string;
  localId?: string;
  globalId?: string;
};

/** Possible call types */
export type CallType = 'audio' | 'video';

/** Where the call was initiated from */
export type CallOrigin =
  | { type: 'directConversation'; conversationId: string }
  | { type: 'groupConversation'; conversation: GroupConversationDetails }
  | { type: 'contacts' }
  | { type: 'callHistory' };

export type CallOriginType =
  | 'directConversation'
  | 'groupConversation'
  | 'contacts'
  | 'callHistory';

/** Parameters required to start a call */
export type StartCallParams = {
  recipients: Partial<IUser>[]; // List of contacts to call
  callType: CallType; // 'audio' | 'video'
  origin: CallOrigin; // Where the call started from
};

/** Call lifecycle states */
type CallState = 'idle' | 'incoming' | 'outgoing' | 'ongoing';

/** Screen share status */
type ScreenShareState = 'idle' | 'pending' | 'active';

/** Room-level call information */
export type RoomType = {
  roomId: string;
  recipients: string[]; // IDs of all recipients
  notifiedRecipents: string[]; // Recipients notified about the call
  owner: Participant | null; // Owner of the call
  callType: string | null; // Current call type
  initialCallType: string; // Type when call started
  callId: string; // Unique call identifier
};

/** Participant-level information in a call */
export interface Participant {
  participantId: string; // Unique participant ID in the call context
  userId: string; // User's unique ID in system
  audioTrack?: MediaStreamTrack; // Local audio track
  videoTrack?: MediaStreamTrack; // Local video track
  audioConsumer: types.Consumer | null; // Incoming audio consumer (mediasoup)
  videoConsumer: types.Consumer | null; // Incoming video consumer (mediasoup)
  translatedAudioConsumer?: types.Consumer | null; // Incoming translated audio stream
  translatedAudioTrack?: MediaStreamTrack | null; // Media track for translated audio
  client: ClientDetails; // User profile info
  isVideoPaused: boolean; // If their video is paused
  isAudioPaused: boolean; // If their audio is muted
  isAudioMutedByHost: boolean; // If their audio is muted by host
  isVideoMutedByHost: boolean; // If their video is muted by host
  isScreenSharing?: boolean; // If they're sharing screen
  audioProducerId?: string; // Mediasoup producer ID for audio
  participantContact?: IUser | null;
}

/** Local producer info (self media streams) */
export type producerT = {
  audioProducer?: types.Producer | null;
  videoProducer?: types.Producer | null;
  audioTrack?: MediaStreamTrack;
  videoTrack?: MediaStreamTrack;
  displayTrack?: MediaStreamTrack;
  isVideoPaused?: boolean;
  isAudioPaused?: boolean;
  videoScreenShareProducer?: types.Producer | null;
  audioScreenShareProducer?: types.Producer | null;
  isScreenSharing?: boolean;
  videoStream?: MediaStream;
  facing_mode?: 'front' | 'back';
};

/** Basic user profile details for call participants */
export interface ClientDetails {
  name: string;
  id: string;
  username: string;
  image?: string;
  bio?: string;
}

/** State flags for call-related popups and requests */
export type callsNotificationType = {
  showSwitchToVideoPopup: boolean;
  showAddPeoplePopup: boolean;
  showScreenShareRequest: boolean;
  screenSharer?: { clientId: string; clientDetails: any };
  isWaitingForScreenShareApproval: boolean;
  showReconnectCallPopup: boolean;
};

/** Incoming call payload from server */
export type incomingCallData = {
  callerId: string;
  roomId: string;
  callType: CallType;
  recipents: RecipientDetail[]; // Who the call is for
  rtpCapabilities: any; // Mediasoup RTP capabilities
  callId: string;
  isGroupCall: boolean;
  initialCallType: CallType;
  recipentList: RecipientDetail[]; // Same as above but maybe formatted differently
  origin?: CallOrigin;
  initiatorDetails: Partial<RecipientDetail>;
  error?: string;
  status?: boolean;
  initiatorId: string;
  serverCallId: string;
};

/** Response from answering a call */
export type answerCallRes = {
  producers: any[];
  roomId: string;
  callType: CallType;
  rtpCapabilites: any;
  recipentId: string;
  callId: string;
  mediaServerData: any;
  initiatorId: string;
  initialPartcipants: Participant[];
};

/** Minimal participant information */
export type RecipientDetail = {
  _id: string;
  name: string;
  username: string;
  email: string;
  image: string;
  id?: string; // for place holder if _id is not available
};

/** Persistent call state information */
export interface CallDetails {
  callId: string;
  roomId: string;
  initiatorId: string;
  state: CallState; // Current lifecycle state
  type: CallType;
  startedAt?: Date;
  duration?: number;
  isGroupCall: boolean;
  initialCallType: CallType;
  isScreenSharing: boolean;
  participants: Participant[];
  recipients: Partial<any>[];
  recipentList: RecipientDetail[];
  screenSharingState: ScreenShareState;
  initiatorDetails: Partial<RecipientDetail> | null;
  origin?: CallOrigin;
  serverCallId?: string;
  clientCallId: string;
  initiatorContact?: IUser | null;
}

/** Payload when consuming a mediasoup producer */
export type consumeRes = {
  error?: any;
  producerId: string;
  id: string; // Consumer ID
  rtpParameters: any;
  kind: 'audio' | 'video';
  participantId: string;
  participant: any;
};

/** Props for handling mediasoup producers */
export type HandleMediasoupProducersProps = {
  socket: Socket<any, any>;
  getDevice: () => Device;
};

/** Options for starting local media production */
export type StartProducingOptions = {
  isScreenSharing?: boolean;
};

/** Allowed producer kinds */
export type ProducerKind = 'audio' | 'video';

/** Server response when starting a call */
export type StartCallRes = {
  error?: any;
  callerId: string;
  roomId: string;
  callType: CallType;
  recipients: string[];
  rtpCapabilities: any;
  callId: string;
  isGroupCall: boolean;
  initialCallType: CallType;
  initiatorId: string;
  recipentList: RecipientDetail[];
  participantId: string;
  serverCallId: string;
};

/** Server response when removing a participant */
export type removeParticipantResponse = {
  status: boolean;
  response: string;
  callId?: string;
  participantId?: string;
  userIdOfParticipant?: string;
};

/** State when user(s) are already in another call */
export type userIsOnOtherCallType = {
  onCallRecipients: RecipientDetail[];
  isGroupCall: boolean;
  areAllBusy: boolean;
};

/** Payload to ignore a call */
export type IgnoreCallPayload = {
  roomId: string;
  userId: string;
  isGroupCall: boolean;
};

/** Translation context for live translated audio */
export type CallTranslationContext = {
  callContext: {
    roomId: string;
    consumerId: string;
    speaker: string;
    listener: string;
    originalProducerId: string;
    targetLang: string;
  };
};
