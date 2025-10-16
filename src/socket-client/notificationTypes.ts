export const notifEvents = {
  calls: {
    incoming: 'calls:incoming',
    missed: 'calls:missed',
    rejected: 'calls:rejected',
    accepted: 'calls:accepted',
    ended: 'calls:ended',
  },
  messages: {
    send: 'messages:send',
    updated: 'messages:updated',
    incoming: 'messages:incoming',

    received: 'messages:received',
    seen: 'messages:seen',
    delete: 'messages:delete',

    pin: 'messages:pin',
    unpin: 'messages:unpin',
    mentioned: 'message:mentioned',
    mentionedEveryOne: 'message:mentionedEveryOne',
    liveLocation: 'messages:status:live_location_update',
    liveLocationStopped: 'messages:status:live_location_stopped',

    disappearDurationUpdated: 'message:disappearDurationUpdated',

    queued: 'messages:queued',

    reaction: {
      add: 'messages:reaction:add',
      update: 'messages:reaction:update',
      remove: 'messages:reaction:remove',
      //to inform other members
      added: 'messages:reaction:added',
      updated: 'messages:reaction:updated',
      removed: 'messages:reaction:removed',
    },
    status: {
      delivered: 'messages:status:delivered',
      seen: 'messages:status:seen',
      deleted: 'messages:status:deleted',
      pinned: 'messages:status:pinned',
      unpinned: 'messages:status:unpinned',
      sentScheduled: 'messages:status:sentScheduled',
    },
    updateScheduled: 'messages:updateScheduled',
  },
  chatSpaces: {
    leave: 'chatSpaces:leave',
    join: 'chatSpaces:join',
    joinViaLink: 'chatSpaces:joinViaLink',
    deleted: 'chatSpace:deleted',
    infoUpdated: 'chatSpace:infoUpdated',
    memberPrivilegesUpdated: 'chatSpace:memberPrivilegesUpdated',
    adminPrivilegesUpdated: 'chatSpace:adminPrivilegesUpdated',
    memberAdded: 'chatSpace:memberAdded', // while created group and added some members
    memberRemoved: 'chatSpace:memberRemoved',
    ownershipTransferred: 'chatSpace:ownershipTransferred',

    getOnlineMembers: 'chatSpace:getOnlineMembers',
    getOnlineMembersResponse: 'chatSpace:getOnlineMembersResponse',
    joinRequestReceived: 'chatSpace:joinRequestReceived',
    joinRequestApproved: 'chatSpace:joinRequestApproved',
    joinRequestRejected: 'chatSpace:joinRequestRejected',
  },
  members: {
    roleUpdated: 'members:roleUpdated',
  },
  users: {
    getOnlineUsers: 'user:getOnlineUsers',
    lastSeen: 'user:lastSeen',
    typing: 'user:typing',
    profile_update: 'user:profileUpdate',
  },
};

export type LeafValues<T> = T extends object ? { [K in keyof T]: LeafValues<T[K]> }[keyof T] : T;

export type NotificationType = LeafValues<typeof notifEvents>;
