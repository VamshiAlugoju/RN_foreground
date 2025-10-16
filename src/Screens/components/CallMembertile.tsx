// import {useCallContext} from '@/lib/contexts/CallProvider';
import {
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  ImageBackground,
  Pressable,
} from 'react-native';
import { useCallContext } from '../../context/CallProvider';
import { CallDetails, Participant } from '../../types/calls.types';

import React, { useEffect, useRef, useState } from 'react';

import {
  RTCView,
  MediaStream,
  MediaStreamTrack,
  mediaDevices,
} from 'react-native-webrtc';
import { BlurView } from '@react-native-community/blur';
import { useMediasoup } from '../../context/RtcProvider';
import VideoCallTile from './VideoCallTile';
import AudioCallTile from './AudioCallTile';

const callMemberTileStyles = StyleSheet.create({
  muteIcon: {
    width: 25,
    height: 25,
  },
});

export type CallMemberTileProps = {
  participent: Participant;
  callDetails: CallDetails;
  seconds?: number;
  idx: number;
  selectUser(participent: Participant, idx: number): void;
  isScreenSharing?: boolean;
  fullScreenMode?: boolean;
  onClick?: () => void;
};

function CallMemberTile({
  participent,
  callDetails,
  selectUser,
  idx,
  isScreenSharing = false,
  fullScreenMode = false,
  onClick,
}: CallMemberTileProps) {
  return (
    <>
      {(callDetails.type === 'video' ||
        (callDetails.type === 'audio' && isScreenSharing)) && (
        <VideoCallTile
          callDetails={callDetails}
          participent={participent}
          selectUser={selectUser}
          idx={idx}
          isScreenSharing={isScreenSharing}
          fullScreenMode={fullScreenMode}
          onClick={onClick}
        />
      )}
      {callDetails.type === 'audio' && !isScreenSharing && (
        <AudioCallTile
          callDetails={callDetails}
          participent={participent}
          selectUser={selectUser}
          isScreenSharing={isScreenSharing}
          idx={idx}
          onClick={onClick}
        />
      )}
    </>
  );
}

export default CallMemberTile;
