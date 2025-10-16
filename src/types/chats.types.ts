export enum MembershipStatus {
  // Active membership states
  MEMBER = 'member',
  ADMIN = 'admin',
  OWNER = 'owner',

  DISCOVERING = 'discovering', // when the user 1st time opens the group/channel
  PENDING = 'pending', // Join request pending approval

  BANNED = 'banned', // Permanently banned

  // System states
  LOADING = 'loading', // Currently checking status
  ERROR = 'error', // Failed to determine status,
}

export type ChatPermissions = {
  canSend: {
    text: boolean;
    media: boolean;
  };
  canAddMembers: boolean;
  canRemoveMembers: boolean;
  canEditChatSpaceInfo: boolean;
  canPinMessages: boolean;
  canDeleteMessages: boolean;
};
