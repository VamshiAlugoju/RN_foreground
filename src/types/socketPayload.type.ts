import {
  ChannelType,
  ConversationType,
  MessageEventType,
  MessageStatus,
  MessageType,
} from '../device-storage/realm/schemas/MessageSchema';
import { AdminPermissions } from '../screens/Home/Groups/AdminPermissions';
import { MemberPermissions } from '../screens/Home/Groups/GroupPermissions';
import { NotificationType } from '../socket-client/notificationTypes';

export type ServerMessage = {
  _id: string;
  senderId: string;
  receiverId: string;
  senderLocalId: string;
  text?: string;
  mediaUrl?: string;
  messageType: MessageType;
  location?: {
    latitude: number;
    longitude: number;
    expiresAt?: number;
    type?: string;
    isStopped?: boolean;
  };
  contact?: { name: string; phoneNumber: string; userId?: string };
  replyToMessageId?: string;
  status: MessageStatus;
  isDeleted?: boolean;
  isPinned?: boolean;
  isSilent?: boolean;
  deletedFor?: string[];
  conversationType: ConversationType;
  deliveredAt?: string;
  seenAt?: string;
  createdAt: string;
  updatedAt: string | Date;
  disappearAfter?: number;
  isTextEdited?: boolean;
  eventType: MessageEventType;
  targetUserIds?: string[];
  mentionedIds?: string[];
  eventPayload?: eventPayload;
  error?: string;
};

export type groupPermissions = {
  member: MemberPermissions;
  admin: AdminPermissions;
};

export type eventPayload = {
  chatSpaceId: string;
  name: string;
  description?: string;
  displayPic?: string;
  updatedBy: string;
  messageId?: string;
  reaction?: string;
  reactionUserId?: string;
  updatedRole?: ChannelType;
  existingRole?: ChannelType;
  updatedPrivileges: MemberPermissions;
};

export type ServerNotification<T> = {
  type: NotificationType;
  body: T;
};

type ReciverAckMessage = {
  globalId: string;
  localId: string;
};

export type IncomingMessagePayload = ServerNotification<ServerMessage>;
export type IncomingDeliveredMessagesPayload = ServerNotification<{
  messageIds: ReciverAckMessage[];
}>;
export type IncomingSeenMessagesPayload = ServerNotification<{
  messageIds: ReciverAckMessage[];
}>;

export type ChatSpace = {
  _id: string;
  name: string;
  type: ConversationType.CHANNEL | ConversationType.GROUP;
  description: string;
  displayPic: any;
  isPrivate: boolean;
  inviteLink: any;
  createdBy: string;
  inviteCode: string;
  chatSpaceId: string;
  isLiveStreaming: boolean;
  lastMessageTimestamp: number;
  createdAt: string;
  updatedAt: string;
  role: ChannelType;
  memberCount: number;
  isDeleted?: boolean;
  isArchived?: boolean;
  groupMemberOverrides?: string;
};

export type PinMessageDto = {
  messageId: string;
  receiverId: string;
  pinnedHours: number;
};

export type PinMessageResponse = {
  status: boolean;
  messageId: string;
  userId: string;
  receiverId: string;
  pinnedHours?: number;
  message?: string;
};

export type UnpinMessageDto = {
  messageId: string;
  receiverId: string;
};

export type UnpinMessageResponse = {
  status: boolean;
  messageId: string;
  userId: string;
  receiverId: string;
  message?: string;
};
