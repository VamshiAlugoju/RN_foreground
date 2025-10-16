import React, { useEffect, useState } from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { useCallContext } from '../../context/CallProvider';
import { CallButtons } from './CallButtons';
import { RTCView } from 'react-native-webrtc';
import UserAvatar from './UserAvatar';
import { zIndex } from '../../utils/Filters';

function OutgoingCal() {
  let membership = 'standard';
  const { callDetails, producers } = useCallContext();

  const [videoUrl, setVideoURL] = useState<string | null>(null);

  useEffect(() => {
    const iffe = async () => {
      if (producers.videoStream && callDetails.type === 'video') {
        const url = producers.videoStream.toURL();
        setVideoURL(url);
      }
    };
    iffe();
  }, [producers?.videoStream]);

  return (
    <LinearGradient
      locations={[0, 0.35, 1]}
      colors={['#e09e61', '#5b2e15', '#000000']}
      style={{
        flex: 1,
        justifyContent: 'center',
        zIndex: zIndex.level_1,
        position: 'relative',
      }}
    >
      {callDetails.type === 'video' && (
        <View
          style={{
            position: 'absolute',
            zIndex: zIndex.level_2,
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
          }}
        >
          {videoUrl ? (
            <RTCView
              mirror={true}
              streamURL={videoUrl}
              style={{
                width: '100%',
                height: '100%',
              }}
              objectFit="cover"
              zOrder={1}
            />
          ) : null}
        </View>
      )}
      <View
        style={{
          flex: 1,
          justifyContent: 'center',
          position: 'relative',
          zIndex: zIndex.level_3,
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
      <CallButtons containerStyles={{ zIndex: zIndex.level_4 }} />
    </LinearGradient>
  );
}

export default OutgoingCal;

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
  singleCallContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarContainer: {
    position: 'absolute',
    zIndex: 1,
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

  goldBadge: {
    position: 'absolute',
    top: -6,
    right: 6,
    borderRadius: 10,
    padding: 3,
  },
  profileContainer: {
    alignItems: 'center',
  },
  profileWrapper: {},
});

const RenderImages = () => {
  const { callDetails } = useCallContext();

  //  For group call where origin is from conversation
  if (callDetails.origin && callDetails.origin.type === 'groupConversation') {
    return (
      <View style={newStyles.singleCallContainer}>
        <View style={newStyles.singleAvatar}>
          <UserAvatar url={callDetails.origin.conversation.displayPic} />
        </View>

        <View style={{ alignItems: 'center', marginTop: 10 }}>
          <Text style={newStyles.title}>
            {callDetails.origin.conversation.displayName}
          </Text>
          <Text style={newStyles.subtitle}>
            Outgoing {callDetails.type} call
          </Text>
        </View>
      </View>
    );
  }

  // For a 1:1 call, show only one participant
  if (
    !callDetails.isGroupCall &&
    callDetails.recipentList &&
    callDetails.recipentList.length > 0
  ) {
    const recipent = callDetails.recipentList[0] || callDetails.recipentList[0];
    return (
      <View style={newStyles.singleCallContainer}>
        <View style={newStyles.singleAvatar}>
          <UserAvatar url={recipent?.image} />
        </View>
        <View style={{ alignItems: 'center', marginTop: 10 }}>
          <Text style={newStyles.title}>
            {recipent.username || recipent.name}
          </Text>
          <Text style={newStyles.subtitle}>
            Outgoing {callDetails.type} call
          </Text>
        </View>
      </View>
    );
  }
  // For group calls, show up to 3 participants and a "+X Others" indicator if needed
  const visibleParticipants = callDetails.recipentList.slice(0, 4);

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
                  <View
                    style={{
                      width: 80,
                      height: 80,
                      borderRadius: 100,
                      borderWidth: 2,
                      borderColor: '#fff',
                    }}
                  >
                    <UserAvatar url={profile.image} />
                  </View>

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
              Outgoing {callDetails.type} call
            </Text>
          </View>
        </View>
      </View>
    </View>
  );
};
