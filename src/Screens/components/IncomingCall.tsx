import React from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  TouchableOpacity,
  ToastAndroid,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { useCallContext } from '../../context/CallProvider';

import { CallDetails } from '../../types/calls.types';
import UserAvatar from './UserAvatar';
import { colors } from '../../theme/colors';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { zIndex } from '../../utils/Filters';
import { getCallPermissions } from '../../context/CallProvider';

import { CallScreenModalKey } from '../MainCallScreen';

import { useMe } from '../../hooks/util/useMe';

function IncomingCall() {
  let membership = 'standard';

  const { callDetails, rejectCall, answerCall } = useCallContext();

  const insets = useSafeAreaInsets();

  async function handleAnswerCall() {
    const hasPermissions = await getCallPermissions({
      callType: callDetails?.type,
    });
    if (!hasPermissions) {
      ToastAndroid.show(
        'Permissions denied to answer call',
        ToastAndroid.SHORT,
      );
      return;
    }

    answerCall({ roomId: callDetails?.roomId });
  }
  function handleRejectCall() {
    rejectCall();
  }

  return (
    <LinearGradient
      locations={[0, 0.35, 1]}
      colors={['#e09e61', '#5b2e15', '#000000']}
      style={{ flex: 1, justifyContent: 'center' }}
    >
      <View
        style={{
          flex: 1,
          justifyContent: 'center',
          position: 'relative',
        }}
      >
        <View style={newStyles.profileContainer}>
          <View
            style={[
              newStyles.profileWrapper,
              { borderColor: membership == 'gold' ? '#F9C32E' : '#EF924F' },
            ]}
          >
            <RenderImages />
          </View>
        </View>
      </View>
      <View
        style={[
          styles.containerStyle,
          {
            paddingBottom: insets.bottom,
            zIndex: zIndex.level_4,
          },
        ]}
      >
        <View style={styles.overlay} />
        <View style={styles.buttonContainer}>
          <TouchableOpacity
            onPress={handleRejectCall}
            style={{ padding: 30, backgroundColor: 'red', borderRadius: 100 }}
          >
            {/* <MaterialIcons name="call-end" size={40} color="white" /> */}
          </TouchableOpacity>
          <TouchableOpacity
            onPress={handleAnswerCall}
            style={{ padding: 30, backgroundColor: 'green', borderRadius: 100 }}
          >
            {/* <Image source={IMAGES.addCall} style={styles.endcallStyle} /> */}
          </TouchableOpacity>
        </View>
      </View>
    </LinearGradient>
  );
}

export default IncomingCall;

const newStyles = StyleSheet.create({
  centerContent: {
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
  },

  textContainer: {
    marginTop: 60,
    alignSelf: 'center',
  },
  title: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  subtitle: {
    color: '#bbb',
    fontSize: 14,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    borderRadius: 100,
    alignItems: 'center',
    justifyContent: 'center',
  },
  extraText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  goldBadge: {
    position: 'absolute',
    top: -6,
    right: 6,
    borderRadius: 10,
    padding: 3,
  },
  profileContainer: {
    alignItems: 'center',
    position: 'absolute',
    bottom: '50%',
    width: '100%',
  },
  profileWrapper: {
    width: '100%',
    height: '100%',
  },

  singleCallContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarContainer: {
    position: 'absolute',
    zIndex: 1,
    // backgroundColor: 'red',
  },
  avatar: {
    width: 120,
    height: 120,
    borderRadius: 100,
    borderWidth: 1,
    borderColor: '#FFFFFF',
  },
  singleAvatar: {
    width: 120,
    height: 120,
    borderRadius: 100,
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
});

const RenderImages = () => {
  const { callDetails } = useCallContext();

  if (callDetails.origin && callDetails.origin.type === 'groupConversation') {
    return (
      <View style={newStyles.singleCallContainer}>
        <Image
          source={{
            uri:
              callDetails.origin.conversation.displayPic ||
              'https://avatar.iran.liara.run/public/boy?username=Ash',
          }}
          style={newStyles.singleAvatar}
        />
        <View style={{ alignItems: 'center', marginTop: 10 }}>
          <Text style={newStyles.title}>
            {callDetails.origin.conversation.displayName}
          </Text>
          <Text style={newStyles.subtitle}>
            {callDetails.initiatorDetails?.name} started {callDetails.type} call
            in group {callDetails.origin.conversation.displayName}
          </Text>
        </View>
      </View>
    );
  }

  // For a 1:1 call, show only one participant
  if (!callDetails?.isGroupCall) {
    return (
      <View style={newStyles.singleCallContainer}>
        <View style={newStyles.singleAvatar}>
          <UserAvatar url={callDetails.initiatorDetails?.image} />
          {/* <Image
            source={{
              uri: callDetails.initiatorDetails?.image,
            }}
            style={newStyles.singleAvatar}
          /> */}
        </View>
        <View style={{ alignItems: 'center', marginTop: 10 }}>
          <Text style={newStyles.title}>
            {callDetails.initiatorDetails?.name || 'Unknown'}
          </Text>
          <Text style={newStyles.subtitle}>
            Incoming {callDetails?.type} call
          </Text>
        </View>
      </View>
    );
  }
  // For group calls, show up to 3 participants and a "+X Others" indicator if needed
  const visibleParticipants = callDetails.recipentList.slice(0, 4);
  const placeholder = require('./profile_image.png');

  return (
    <View style={newStyles.centerContent}>
      <View
        style={{
          justifyContent: 'center',
        }}
      >
        <View style={{ alignSelf: 'center' }}>
          {visibleParticipants.map((profile, index) => {
            if (index <= 2) {
              const showOverlay =
                callDetails.recipentList.length > 3 && index === 2;
              return (
                <View
                  key={profile._id}
                  style={[{ left: index * 40, position: 'absolute' }]}
                >
                  <Image
                    source={
                      profile?.image && profile.image.trim().length > 0
                        ? { uri: profile.image }
                        : placeholder
                    }
                    style={{
                      width: 80,
                      height: 80,
                      borderRadius: 100,
                      borderWidth: 2,
                      borderColor: '#fff',
                    }}
                  />
                  {showOverlay && (
                    <View style={newStyles.overlay}>
                      <Text style={[newStyles.extraText, { fontSize: 15 }]}>
                        +{callDetails.recipentList.length - 3}
                      </Text>
                      <Text style={newStyles.extraText}>Others</Text>
                    </View>
                  )}
                </View>
              );
            }
            return null;
          })}
          <View style={{ marginTop: 85, alignSelf: 'center' }}>
            <Text style={newStyles.title}>
              Group Call ({callDetails.recipentList.length})
            </Text>
            <Text style={newStyles.subtitle}>
              Incoming {callDetails.type} call
            </Text>
          </View>
        </View>
      </View>
    </View>
  );
};

export function buildIncomingCallTitle(callDetails: CallDetails) {
  if (callDetails.origin && callDetails.origin.type === 'groupConversation') {
    return callDetails.origin.conversation.displayName;
  }

  return callDetails.initiatorDetails?.name || 'Unknown';
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
    padding: 10,
    borderRadius: 50,
  },
});
