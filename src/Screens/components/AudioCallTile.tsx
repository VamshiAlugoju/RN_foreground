// import {useCallContext} from '@/lib/contexts/CallProvider';
import {
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  ImageBackground,
  Pressable,
  ToastAndroid,
  StyleProp,
  TextStyle,
} from 'react-native';
import { CallDetails, Participant } from '../../types/calls.types';

import React, { useEffect, useRef, useState } from 'react';

import { MediaStream } from 'react-native-webrtc';
import { BlurView } from '@react-native-community/blur';

import { CallMemberTileProps } from './CallMembertile';
// import { FeatherIcons } from '../../utils/vectorIcons';
import { useCallContext } from '../../context/CallProvider';

const DEFAULT_IMAGE = require('./profile_image.png');

export default function AudioCallTile({
  participent,
  callDetails,
  selectUser,
  idx,
  fullScreenMode,
  onClick,
}: CallMemberTileProps) {
  const seconds = 0;
  return (
    <View style={audioCallTileStyles.container}>
      {/* Top bar */}
      <View style={audioCallTileStyles.topBar}>
        <TouchableOpacity
          style={audioCallTileStyles.optionsButton}
        ></TouchableOpacity>
      </View>

      {/* Audio Renderer */}
      <View style={audioCallTileStyles.audioWrapper}>
        {callDetails.type === 'audio' && (
          <AudioRenderer
            participent={participent}
            callDetails={callDetails}
            seconds={seconds.toString()}
            selectUser={selectUser}
            idx={idx}
            fullScreenMode={fullScreenMode ? fullScreenMode : false}
            onClick={onClick}
          />
        )}
      </View>
    </View>
  );
}

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

function AudioRenderer({
  participent,
  callDetails,
  seconds,
  onClick,
  idx,
  selectUser,
}: VideoAudioRendererProps) {
  const { audioTrack, audioConsumer } = participent;
  const audioStreamRef = useRef<MediaStream | null>(null);
  const { muteParticipantMedia, unmuteParticipantMedia } = useCallContext();

  useEffect(() => {
    if (audioTrack) {
      const stream = new MediaStream([audioTrack]);

      audioStreamRef.current = stream;
    }

    return () => {
      audioStreamRef.current = null;
      audioConsumer?.off('@pause', () => {});
      audioConsumer?.off('@resume', () => {});
    };
  }, [audioTrack]);

  const img = participent?.client?.image?.trim?.() || '';
  const hasBgImage = img.length > 0;

  const Background: React.FC<{ children: React.ReactNode }> = ({ children }) =>
    hasBgImage ? (
      <ImageBackground source={{ uri: img }} style={audioCallTileStyles.bgImage}>
        {children}
      </ImageBackground>
    ) : (
      <View style={[audioCallTileStyles.bgImage, audioCallTileStyles.bgFallback]}>
        {children}
      </View>
    );

  return (
    <Background>
      <BlurView blurType="dark" blurAmount={90} />
      <Pressable
        onPress={e => {
          onClick && onClick();
        }}
        onLongPress={() => {
          selectUser(participent, idx);
        }}
        style={audioCallTileStyles.pressableArea}
      >
        <View style={audioCallTileStyles.centerBox}>
          <Image
            source={hasBgImage ? { uri: img } : DEFAULT_IMAGE}
            style={audioCallTileStyles.avatar}
          />
          <Text style={audioCallTileStyles.username}>
            {participent?.client?.username}
          </Text>
          {(callDetails.state === 'incoming' ||
            callDetails.state === 'outgoing') && (
            <Text
              style={[
                audioCallTileStyles.statusText,
                callDetails?.participants?.length === 1 &&
                  audioCallTileStyles.statusMargin,
              ]}
            >
              {callDetails.state === 'incoming' && 'Incoming audio call'}
              {callDetails.state === 'outgoing' && 'Ringing'}
            </Text>
          )}
        </View>
      </Pressable>
    </Background>
  );
}

const audioCallTileStyles = StyleSheet.create({
  container: {
    width: '100%',
    height: '100%',
  },
  bgImage: {
    flex: 1,
    justifyContent: 'center',
  },
  bgFallback: {
    backgroundColor: '#001F3F',
  },
  topBar: {
    position: 'absolute',
    top: 0,
    width: '100%',
    padding: 8,
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    zIndex: 10,
  },
  optionsButton: {
    padding: 8,
  },
  audioWrapper: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  pressableArea: {
    paddingVertical: 40,
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderColor: '#FFFFFF',
  },
  centerBox: {
    alignItems: 'center',
    justifyContent: 'center',
    height: 190,
    width: 300,
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
  },
  username: {
    fontSize: 16,
    marginTop: 5,
    color: '#FFF',
  },
  statusText: {
    color: '#FFF',
  },
  statusMargin: {
    marginTop: 10,
  },
  micButton: {
    padding: 10,
    borderRadius: 100,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  micButtonActive: {
    backgroundColor: 'white',
  },
});

type RenderCallTimerProps = {
  textStyles?: StyleProp<TextStyle>;
};

export function RenderCallTimer({ textStyles }: RenderCallTimerProps) {
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const { callDetails } = useCallContext();

  // start the
  const startedAt: Date | undefined = callDetails?.startedAt;
  const initialSeconds = startedAt
    ? Math.floor((Date.now() - new Date(startedAt).getTime()) / 1000)
    : 0;

  // use the startedAt time as base and calculate the time difference and initialise it as seconds
  const [seconds, setSeconds] = useState(initialSeconds);

  useEffect(() => {
    if (callDetails?.state === 'ongoing' && !timerRef.current) {
      timerRef.current = setInterval(() => {
        setSeconds(prev => prev + 1);
      }, 1000);
    }

    // Cleanup if component unmounts or call ends
    if (callDetails?.state !== 'ongoing' && timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
      setSeconds(0); // Reset timer if needed
    }

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [callDetails?.state]);
  const formatTime = (totalSeconds: any) => {
    const mins = Math.floor(totalSeconds / 60)
      .toString()
      .padStart(1, '0');
    const secs = (totalSeconds % 60).toString().padStart(2, '0');
    return `${mins}:${secs}`;
  };

  return (
    <Text style={[audioCallTileStyles.statusText, textStyles]}>
      {callDetails.state === 'ongoing' && formatTime(seconds)}
    </Text>
  );
}
