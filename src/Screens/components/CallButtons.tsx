import React, { Dispatch, SetStateAction } from 'react';
import {
  View,
  Image,
  TouchableOpacity,
  StyleSheet,
  StyleProp,
  ViewStyle,
} from 'react-native';
import { BlurView } from '@react-native-community/blur';
import { useCallContext } from '../../context/CallProvider';

import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { zIndex } from '../../utils/Filters';

import { colors } from '../../theme/colors';

type CallButtonsProps = {
  containerStyles?: StyleProp<ViewStyle>;
};

export function CallButtons({
  // setOptionsModal,
  // setCallMembersModal,
  containerStyles,
}: CallButtonsProps) {
  const {
    callDetails,

    endCall,
  } = useCallContext();

  const insets = useSafeAreaInsets();

  switch (callDetails.state) {
    case 'outgoing':
      return (
        <View
          style={[
            styles.containerStyle,
            {
              paddingBottom: insets.bottom,
            },
            containerStyles,
          ]}
        >
          <View style={styles.overlay} />
          <View style={styles.buttonContainer}>
            <TouchableOpacity
              onPress={() => {
                endCall('outgoing');
              }}
              style={styles.endCallButton}
            >
              {/* <MaterialIcons name="call-end" size={40} color="white" /> */}
            </TouchableOpacity>
          </View>
        </View>
      );

    case 'ongoing':
      return (
        <View
          style={[
            styles.containerStyle,
            {
              paddingBottom: insets.bottom,
              zIndex: zIndex.level_2,
            },
            containerStyles,
          ]}
        >
          <BlurView
            style={StyleSheet.absoluteFill}
            blurType="dark"
            blurAmount={6}
            reducedTransparencyFallbackColor="rgba(0, 0, 0, 0.25)"
          />
          <TouchableOpacity onPress={() => {}}>
            <View style={styles.dragIndicator} />
          </TouchableOpacity>

          <View style={styles.buttonContainer}>
            {/* <TouchableOpacity onPress={toggleAudioTrack}>
              <Image
                source={IMAGES.mute_fill}
                style={[
                  styles.muteIconLarge,
                  { display: producers.isAudioPaused ? 'flex' : 'none' },
                ]}
                resizeMode="contain"
              />
              <Image
                source={IMAGES.mute_white}
                style={[
                  styles.muteIconSmall,
                  { display: producers.isAudioPaused ? 'none' : 'flex' },
                ]}
                resizeMode="contain"
              />
            </TouchableOpacity> */}

            <TouchableOpacity
              onPress={() => endCall()}
              style={styles.endCallButton}
            >
              {/* <MaterialIcons name="call-end" size={40} color="white" /> */}
            </TouchableOpacity>
          </View>
        </View>
      );

    default:
      return null;
  }
}

const styles = StyleSheet.create({
  iconStyle: {
    width: 40,
    height: 40,
  },
  endcallStyle: {
    width: 50,
    height: 50,
  },
  containerStyle: {
    position: 'absolute',
    bottom: 0,
    width: '100%',
    borderTopLeftRadius: 25,
    borderTopRightRadius: 25,
    overflow: 'hidden',
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-evenly',
    alignItems: 'center',
    paddingVertical: 15,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.25)',
  },
  shadeButtonStyles: {
    backgroundColor: colors.overlayWhite_20,
    padding: 10,
    borderRadius: 50,
  },
  dragIndicator: {
    width: 60,
    height: 5,
    alignSelf: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    marginTop: 10,
    borderRadius: 50,
  },
  muteIconLarge: {
    width: 40,
    height: 40,
  },
  muteIconSmall: {
    width: 30,
    height: 30,
  },
  endCallButton: {
    backgroundColor: 'red',
    padding: 30,
    borderRadius: 100,
  },
});
