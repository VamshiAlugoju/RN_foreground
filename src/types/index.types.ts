import {
  ConversationType,
  MessageEventType,
  MessageType,
} from '../device-storage/realm/schemas/MessageSchema';

// contact types
export type Contacts = {
  registered: RegisteredContact[];
  unregistered: UnregisteredContact[];
};

export type UnregisteredContact = {
  name: string;
  number: string;
};
export type RegisteredContact = UnregisteredContact & {
  userId: string;
};

// export interface IUser {
//   _id: string;
//   phoneCode: string;
//   phoneNumber: string;
//   email?: string;
//   username: string;
//   name: string;
//   bio?: string;
//   dateOfBirth: Date;
//   gender: 'MALE' | 'FEMALE' | 'OTHER';
//   image?: string | null;
//   animatedProfile?: {
//     index?: number;
//     url?: string;
//   };
//   e164CompliantNumber: string;
// }

export type ComposedMessage = {
  senderId: string;
  receiverId: string;
  conversationType: ConversationType;
  isSilent?: boolean;
  scheduledAt?: number;
  disappearAfter?: number;
  replyToMessageId?: string;
  isMedia?: boolean;
} & (
  | TextMessage
  | MediaMessage
  | LocationMessage
  | ContactMessage
  | EventMessage
);

export type RootStackParamList = {
  DocumentPreviewScreen: {
    fileUrl: string;
    fileName: string;
    fileSize: number;
    composedMessageProp: ComposedMessage;
    onSend?: (
      finalMessage: ComposedMessage,
      isMedia?: boolean,
    ) => Promise<void>;
    isFromChat?: boolean;
  };
};

export type TextMessage = {
  text: string;
  messageType: MessageType.TEXT;
  localId?: string;
};

export type EditedTextMessage = {
  text: string;
  messageType: MessageType.TEXT;
  localId: string;
};

export type MediaMessage = {
  mediaUrl: string;
  messageType:
    | MessageType.IMAGE
    | MessageType.VIDEO
    | MessageType.AUDIO
    | MessageType.DOCUMENT
    | MessageType.VOICE;
  text?: string;
  fileName?: string;
  fileSize?: number;
  mimeType?: string;
  localPath?: string;
};

export type LocationMessage = {
  location: {
    latitude: number;
    longitude: number;
    type?: string;
    expiresAt?: number;
    isStopped?: boolean;
  };
  messageType: MessageType.LOCATION;
};

export type ContactMessage = {
  contact: {
    name: string;
    phoneNumber: string;
    userId?: string;
  };
  messageType: MessageType.CONTACT;
};

export type EventMessage = {
  messageType: MessageType.EVENT;
  eventType: MessageEventType;
  eventPayload: Object;
  targetUserIds?: string[];
};

type Location = {
  type: 'Point';
  coordinates: [number, number]; // [longitude, latitude]
};
export type RemoteUser = {
  bio: string;
  contacts: any[]; // Adjust type if more info on contacts is known
  createdAt: string; // ISO date string
  dateOfBirth: string; // ISO date string
  e164CompliantNumber: string;
  gender: string; // e.g., "MALE", consider using enum if available
  image: string;
  location: Location;
  name: string;
  phoneCode: string;
  phoneNumber: string;
  updatedAt: string; // ISO date string
  username: string;
  _id: string;
};
