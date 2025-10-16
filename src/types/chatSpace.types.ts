import { ChannelType, ConversationType } from "../device-storage/realm/schemas/MessageSchema";
import { MembershipStatus } from "./chats.types";

// channel
export interface Channel {
  _id: string;
  name: string;
  type: 'channel';
  description: string;
  displayPic: string | undefined;
  isPrivate: boolean;
  inviteLink: string | null;
  createdBy: string;
  chatSpaceId: string;
  isLiveStreaming: boolean;
  isStreamReadyToWatch: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface MyChatspace {
  _id: string;
  name: string;
  type: ConversationType;
  description: string;
  displayPic?: string;
  isPrivate: boolean;
  inviteLink?: string;
  inviteCode?: string;
  createdBy: string;
  memberCount: number;
  chatSpaceId: string;
  createdAt: string;
  updatedAt: string;
  role: any;
}

export interface MyGroups extends MyChatspace {
  type: ConversationType.GROUP;
}

export interface MyChannels extends MyChatspace {
  type: ConversationType.CHANNEL;
  isLiveStreaming: boolean;
}

export interface ChatSpacesResponse {
  groups: MyGroups[];
  groupCount: number;
  channels: MyChannels[];
  channelCount: number;
}

export type StreamInfo = {
  channelId: string;
  chatSpaceId: string;
  createdAt: string;
  updatedAt: string;
  ingestUrl: string;
  isPrivateStream: boolean;
  isScheduled: boolean;
  playbackUrl: string;
  __v: number;
  _id: string;
};

export type ViewerStreamInfo = Omit<StreamInfo, 'ingestUrl'>;

export interface Group {}
