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

import { CallMemberTileProps } from './CallMembertile';

const DEFAULT_IMAGE = require('../UserAvatar.png');

export default function VideoCallTile({
  participent,
  selectUser,
  idx,
  isScreenSharing = false,
  fullScreenMode = false,
  onClick,
}: CallMemberTileProps) {
  const { callDetails } = useCallContext();

  return (
    <View
      style={[
        vidCallTileStyles.tileContainer,
        !fullScreenMode ? vidCallTileStyles.tileBorderRight : undefined,
        idx > 1 && !fullScreenMode
          ? vidCallTileStyles.tileBorderTop
          : undefined,
      ]}
    >
      {/* Top Bar */}

      {/* Main Video Area */}
      <View style={vidCallTileStyles.videoArea}>
        <VideoRenderer
          participent={participent}
          isScreenSharing={isScreenSharing}
          callDetails={callDetails}
          idx={idx}
          fullScreenMode={fullScreenMode}
          selectUser={selectUser}
          onClick={onClick}
        />
      </View>

      {/* Bottom Bar */}
    </View>
  );
}

/**
 * Component responsible for rendering video and audio for a participent
 */

interface VideoAudioRendererProps {
  participent: Participant; // Fixed typo in prop name
  callDetails: CallDetails; // <-- Add this line
  seconds?: string;
  isScreenSharing?: boolean;
  idx: number;
  fullScreenMode: boolean;
  selectUser: (participant: Participant, idx: number) => void;
  onClick?: () => void;
}

function VideoRenderer({
  participent,
  isScreenSharing = false,
  callDetails,
  idx,
  selectUser,
  fullScreenMode,
  onClick,
}: VideoAudioRendererProps) {
  const [videoURL, setVideoURL] = useState<string | null>(null);
  const [audioStream, setAudioStream] = useState<MediaStream | null>(null);
  const [muted, setMuted] = useState<boolean>(false);
  // Handle video stream
  useEffect(() => {
    const iffe = async () => {
      if (participent.videoTrack) {
        const stream = new MediaStream([participent.videoTrack]);
        const url = stream.toURL();

        setVideoURL(url);
      } else {
        setVideoURL(null);
      }

      return () => {
        setVideoURL(null);
      };
    };
    iffe();
  }, [participent.videoTrack, participent.participantId, isScreenSharing]);

  // Handle audio stream (just keep it alive)
  useEffect(() => {
    if (participent.audioTrack) {
      const stream = new MediaStream([participent.audioTrack]);
      setAudioStream(stream);
    } else {
      setAudioStream(null);
    }

    return () => {
      setAudioStream(null);
    };
  }, [participent.audioTrack, participent.participantId, isScreenSharing]);

  const toggleMute = () => {
    const audioTrack = participent?.audioTrack;
    if (audioTrack) {
      audioTrack.enabled = !audioTrack.enabled;
      const isMuted = !audioTrack.enabled;
      setMuted(isMuted);
    } else {
      console.warn('Audio track not available');
    }
  };

  return (
    <Pressable
      style={videoRendererStyles.container}
      onPress={e => {
        onClick && onClick();
      }}
      onLongPress={e => {
        selectUser(participent, idx);
      }}
    >
      {videoURL && (!participent.isVideoPaused || isScreenSharing) && (
        <RTCView
          mirror={isScreenSharing ? false : true} // should be false for screen sharing, coz screen sharing is not mirror
          streamURL={videoURL}
          style={[
            videoRendererStyles.video,
            isScreenSharing && videoRendererStyles.screenSharing,
          ]}
          objectFit="cover"
        />
      )}

      <View
        style={[
          videoRendererStyles.overlayBar,
          { justifyContent: !fullScreenMode ? 'space-between' : 'center' },
        ]}
      >
        <View>
          <Text style={videoRendererStyles.overlayNameText}>
            {participent?.client?.name}
          </Text>
        </View>
      </View>

      <TouchableOpacity
        onPress={e => {
          e.stopPropagation();
          toggleMute();
        }}
        style={[
          videoRendererStyles.muteButton,
          { display: fullScreenMode ? 'flex' : 'none' },
        ]}
      ></TouchableOpacity>
    </Pressable>
  );
}

const vidCallTileStyles = StyleSheet.create({
  tileContainer: {
    height: 370,
    flex: 1,
    overflow: 'hidden',
    borderColor: '#FFF',
  },
  tileBorderRight: {
    borderRightWidth: 1,
  },
  tileBorderTop: {
    borderTopWidth: 1,
  },
  fullScreenBorder: {
    borderWidth: 1,
    borderColor: '#FFFFFF',
  },
  topBar: {
    position: 'absolute',
    top: 0,
    width: '100%',
    padding: 8,
    zIndex: 50,
  },
  fullScreenTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  miniTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  avatar: {
    width: 24,
    height: 24,
    borderRadius: 999,
  },
  username: {
    color: 'white',
    fontSize: 14,
    fontWeight: '500',
  },
  rightControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  videoArea: {
    flex: 1,
  },
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    width: '100%',
    paddingVertical: 8,
    paddingHorizontal: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: 'transparent',
  },
});
const videoRendererStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#374151', // Tailwind bg-gray-700
  },
  video: {
    width: '100%',
    height: '100%',
  },
  centered: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  overlayBar: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    position: 'absolute',
    bottom: 20,
    paddingHorizontal: 15,
    width: '100%',
  },
  overlayNameText: {
    color: '#fff',
  },
  muteButton: {
    top: 12,
    right: 15,
    position: 'absolute',
  },
  muteIcon: {
    width: 22,
    height: 22,
  },
  screenSharing: {
    borderWidth: 2,
    borderColor: '#3b82f6', // Tailwind border-blue-500
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  profileWrapper: {
    borderWidth: 3,
    borderRadius: 100,
  },
});
