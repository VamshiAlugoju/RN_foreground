import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  StatusBar,
  ActivityIndicator,
  BackHandler,
  Alert,
  AppState,
} from 'react-native';
import { commonFontStyle } from '../theme/fonts';
import { colors } from '../theme/colors';

import { useCallContext } from '../context/CallProvider';
import OutgoingCal from './components/OutgoingCal';

import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Participant } from '../types/calls.types';
import IncomingCall from './components/IncomingCall';

import OngoingCall from './components/OngoingCall';
import { zIndex } from '../utils/Filters';

export type RootStackParamList = {
  Details: any;
};
export type CallScreenModals = {
  showAddPeople: boolean;
  showSwitchToVideoRequest: boolean;
};

export type CallScreenModalKey = keyof CallScreenModals;

const MainCallScreen = () => {
  const [showingFooter, setShowningFooter] = useState(true);

  const [fullScreenMode, setFullScreenMode] = useState(false);
  const {
    callDetails,
    callNotifications,
    setShowFullScreenCall,
    showFullScreenCall,
  } = useCallContext();

  const [callModalState, setCallModalState] = useState<CallScreenModals>({
    showAddPeople: false,
    showSwitchToVideoRequest: false,
  });

  const insets = useSafeAreaInsets();
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [participantsCopy, setParticipantsCopy] = useState<Participant[]>([]);

  useEffect(() => {
    if (
      callDetails?.state === 'ongoing' &&
      Array.isArray(callDetails?.participants)
    ) {
      const currJsonpts = JSON.stringify(participants);
      const newJsonpts = JSON.stringify(callDetails.participants);

      if (currJsonpts !== newJsonpts) {
        setParticipants(callDetails.participants);
        setParticipantsCopy(callDetails.participants);
      }
    }
  }, [callDetails?.state, callDetails?.participants]);

  // Auto-hide footer for video calls
  useEffect(() => {
    if (
      callDetails?.type === 'video' &&
      callDetails?.state === 'ongoing' &&
      showingFooter
    ) {
      const timeoutId = setTimeout(() => {
        setShowningFooter(false);
      }, 7000);

      return () => clearTimeout(timeoutId); // Clear if state/type changes
    }
  }, [callDetails?.type, callDetails?.state, showingFooter]);

  const openModal = (modal: CallScreenModalKey) => {
    setCallModalState(prevState => {
      const newState = Object.keys(prevState).reduce((acc, key) => {
        acc[key as CallScreenModalKey] = key === modal;
        return acc;
      }, {} as Record<CallScreenModalKey, boolean>);
      return newState;
    });
  };

  const closeModal = (modal: CallScreenModalKey) => {
    setCallModalState(prevState => ({ ...prevState, [modal]: false }));
  };

  useEffect(() => {
    if (!showFullScreenCall) return; // don't attach if false

    const backAction = () => {
      setShowFullScreenCall(false);
      return true; // block default back action
    };

    const backHandler = BackHandler.addEventListener(
      'hardwareBackPress',
      backAction,
    );

    // cleanup: runs when showFullScreenCall changes OR component unmounts
    return () => {
      backHandler.remove();
    };
  }, [showFullScreenCall]);

  // Check for ongoing calls when app comes to foreground
  useEffect(() => {
    const handleAppStateChange = (nextAppState: string) => {
      console.log('AppState changed to:', nextAppState);
      if (nextAppState === 'active') {
        // Small delay to ensure call state is loaded
        setTimeout(() => {
          console.log('Checking call state on app resume:', callDetails?.state);
          console.log('Full callDetails object:', JSON.stringify(callDetails, null, 2));
          // App came to foreground - check if there's an ongoing call
          if (callDetails && (callDetails.state === 'ongoing' || callDetails.state === 'outgoing')) {
            console.log('App resumed with ongoing call, showing call UI');
            setShowFullScreenCall(true);
            
            // Check if we need to wait for reconnection
            if (callDetails.state === 'ongoing') {
              console.log('Checking connection status for ongoing call...');
              // The EndCall button will show proper error if connection is not available
              // This is handled in the CallProvider's endCall function
            }
          } else {
            console.log('No ongoing call detected, callDetails:', callDetails);
          }
        }, 100);
      }
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => subscription?.remove();
  }, [callDetails, setShowFullScreenCall]);

  // Debug: Log call state changes
  useEffect(() => {
    console.log('Call state changed to:', callDetails?.state);
    console.log('Show full screen call:', showFullScreenCall);
  }, [callDetails?.state, showFullScreenCall]);

  if (callDetails.state === 'idle') {
    return null;
  }

  return (
    <View
      style={{
        flex: 1,
        paddingTop: insets.top,
        paddingBottom: insets.bottom,
      }}
    >
      <StatusBar
        barStyle="light-content"
        backgroundColor="#111111"
        translucent={false}
      />

      {callDetails.state === 'outgoing' && <OutgoingCal />}

      {callDetails.state === 'incoming' && <IncomingCall />}

      {callDetails.state === 'ongoing' && (
        <OngoingCall
          fullScreenMode={fullScreenMode}
          participants={participants}
          setFullScreenMode={setFullScreenMode}
          setShowningFooter={setShowningFooter}
          showingFooter={showingFooter}
          callModalState={callModalState}
          closeModal={closeModal}
          openModal={openModal}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  absolute: {
    position: 'absolute',
    top: 0,
    left: 0,
    bottom: 0,
    right: 0,
  },
  callBgIcon: {
    position: 'absolute',
    height: 215,
    resizeMode: 'stretch',
  },
  profileImage: {
    width: 100,
    height: 100,
    borderRadius: 50,
  },
  iconStyle: {
    width: 40,
    height: 40,
  },
  iconStyle1: {
    width: 24,
    height: 24,
  },
  endcallStyle: {
    width: 50,
    height: 50,
  },
  name: {
    ...commonFontStyle(600, 20, colors.white),
    textAlign: 'center',
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-evenly',
    alignItems: 'center',
    paddingVertical: 15,
  },
  buttonContainer1: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    right: 10,
  },

  header: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
  },
  video: {
    width: '100%',
    height: 200,
    backgroundColor: '#000',
  },
  blurContainer: {
    ...StyleSheet.absoluteFillObject,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    paddingVertical: 4,
    paddingHorizontal: 12,
    borderRadius: 12,
  },
  searchInput: {
    flex: 1,
    marginLeft: 8,
    color: '#fff',
    fontSize: 14,
  },
  languageItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
  },
  flag: {
    fontSize: 18,
    marginRight: 10,
  },
  languageName: {
    flex: 1,
    fontSize: 16,
    color: '#fff',
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.25)',
  },
  box: {
    width: 100,
    height: 100,
    backgroundColor: 'salmon',
    borderRadius: 8,
    position: 'absolute',
    top: 100,
    left: 100,
    zIndex: 1000,
    elevation: 10,
  },
  imageWrapper: {
    width: 100,
    height: 100,
    borderRadius: 50,
    overflow: 'hidden',
    position: 'relative',
  },
  image: {
    width: '100%',
    height: '100%',
    position: 'absolute',
  },
  centerContent: {
    flex: 1,
    width: '100%',
  },

  gridContainer: {
    flex: 1,
    width: '100%',
  },

  fullScreenParticipant: {
    flex: 1,
    width: '100%',
  },
  twoParticipantsContainer: {
    flex: 1,
    flexDirection: 'column',
  },
  halfScreenParticipant: {
    flex: 1,
    width: '100%',
  },
  threeParticipantsContainer: {
    flex: 1,
    width: '100%',
  },
  firstRow: {
    flex: 1,
    flexDirection: 'row',
    width: '100%',
  },
  secondRow: {
    flex: 1,
    width: '100%',
  },
  halfWidthTile: {
    flex: 1,
    width: '50%',
    height: '100%',
  },
  fullWidthTile: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
});

export default MainCallScreen;

export const MainCallScreenOverlay = () => {
  const { callDetails, showFullScreenCall } = useCallContext();

  if (callDetails?.state === 'idle') {
    return null;
  }

  return (
    <View
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: zIndex.level_5,
        display: showFullScreenCall ? 'flex' : 'none',
      }}
    >
      <MainCallScreen />
    </View>
  );
};
