import React, { useState, useRef, useEffect, use } from 'react';
import { colors } from '../../theme/colors';
import {
  View,
  Image,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  PanResponder,
  Animated,
  Dimensions,
  BackHandler,
  ToastAndroid,
  PermissionsAndroid,
} from 'react-native';

import { useCallContext } from '../../context/CallProvider';
import { Participant } from '../../types/calls.types';
import { commonFontStyle, hp, wp } from '../../theme/fonts';
import { CallScreenModalKey, CallScreenModals } from '../MainCallScreen';
import { useMediasoup } from '../../context/RtcProvider';
import { zIndex } from '../../utils/Filters';
import useResetTimer from '../../hooks/calls/useresettimer';
import { CallButtons } from './CallButtons';
import SingleParticipantView from './PartcipantViews/SingleParticipantView';
import TwoParticipantView from './PartcipantViews/TwoParticipantView';
import ThreeParticipantView from './PartcipantViews/ThreeParticipantView';
import GridParticipantsView from './PartcipantViews/GridParticipantsView';

const SCREEN_SHARE_BANNER_TIME = 5 * 1000;
const FULL_SCREEN_TIMEOUT = 5 * 1000;

type SelectedUser = {
  participant: Participant | null;
  idx: number | null;
};

type OngoingCallProps = {
  fullScreenMode: boolean;
  setFullScreenMode: React.Dispatch<React.SetStateAction<boolean>>;
  setShowningFooter: React.Dispatch<React.SetStateAction<boolean>>;
  showingFooter: boolean;
  participants: Participant[];
  callModalState: CallScreenModals;
  openModal: (modal: CallScreenModalKey) => void;
  closeModal: (modal: CallScreenModalKey) => void;
};

type ScreenSharingBannerState = {
  visible: boolean;
  participant: Participant | null;
  timer: NodeJS.Timeout | null;
};

// create a component
const OngoingCall = ({
  fullScreenMode,
  setFullScreenMode,
  setShowningFooter,
  showingFooter,
  participants,
  callModalState,
  openModal,
  closeModal,
}: OngoingCallProps) => {
  const { callDetails } = useCallContext();
  const { mediaConsumers, mediaProducers } = useMediasoup();
  // const insets = useSafeAreaInsets();
  const {
    startTimer,
    resetTimer,
    stopTimer,
    timerCompleted: renderFullScreen,
  } = useResetTimer(FULL_SCREEN_TIMEOUT);

  const [selectedUser, setSelectedUser] = useState<SelectedUser>({
    idx: null,
    participant: null,
  });

  const [selectedScreenSharer, setSelectedScreenSharer] =
    useState<SelectedUser>({
      idx: null,
      participant: null,
    });

  const [showScreenSharingBanner, setShowScreenSharingBanner] =
    useState<ScreenSharingBannerState>({
      visible: false,
      participant: null,
      timer: null,
    });

  const renderParticipantsGrid = () => {
    const participants = callDetails.participants;
    const participantCount = participants.length;
    // Case 1: Single participant (full screen)
    if (participants.length === 1) {
      return (
        <SingleParticipantView
          participants={participants}
          callDetails={callDetails}
          selectUser={selectUser}
          fullScreenMode={fullScreenMode}
        />
      );
    }

    // Case 2: Two participants (split screen vertical)
    if (participantCount === 2) {
      return (
        <TwoParticipantView
          participants={participants}
          callDetails={callDetails}
          selectUser={selectUser}
          fullScreenMode={fullScreenMode}
        />
      );
    }

    // Case 3: Three participants (special layout - 2 in first row, 1 full width in second row)
    if (participantCount === 3) {
      return (
        <ThreeParticipantView
          participants={participants}
          callDetails={callDetails}
          selectUser={selectUser}
          fullScreenMode={fullScreenMode}
        />
      );
    }

    // Case 4 and more: Four or more participants (2×2 grid with potential scrolling)
    return (
      <GridParticipantsView
        participants={participants}
        callDetails={callDetails}
        selectUser={selectUser}
        fullScreenMode={fullScreenMode}
      />
    );
  };
  function selectUser(participant: Participant, idx: number) {}

  const resetScreenShareBanner = () => {};

  useEffect(() => {
    const sharers = mediaConsumers.screenSharers;

    if (!sharers || sharers.length === 0) {
      setFullScreenMode(false);
      resetScreenShareBanner();
      setSelectedScreenSharer({ participant: null, idx: null });
      stopTimer();
      return;
    }

    if (selectedScreenSharer?.idx != null) return;

    const firstSharer = sharers[0];
    const participant = participants[firstSharer.idx];
    if (!participant) return;

    setFullScreenMode(true);
    setSelectedScreenSharer({ idx: firstSharer.idx, participant: participant });
    setSelectedUser({ idx: null, participant: null });
    if (showScreenSharingBanner.timer) {
      clearTimeout(showScreenSharingBanner.timer);
    }

    const timerId = setTimeout(() => {
      resetScreenShareBanner();
      startTimer();
    }, SCREEN_SHARE_BANNER_TIME);

    setShowScreenSharingBanner({
      participant,
      visible: true,
      timer: timerId,
    });
  }, [
    mediaConsumers.screenSharers.length,
    participants,
    selectedScreenSharer?.idx,
    showScreenSharingBanner.timer,
  ]);

  function handleBackPress() {
    if (fullScreenMode) {
      // setFullScreenMode(false);
      // setSelectedUser({ idx: null, participant: null });
      // setSelectedScreenSharer({ idx: null, participant: null });
      return true;
    }
    return false;
  }

  function handleBackButton() {
    // if (showFullScreenCall === true) {
    //   setShowFullScreenCall(false);
    // }
    // if (fullScreenMode) {
    //   setFullScreenMode(false);
    //   setSelectedUser({ idx: null, participant: null });
    //   setSelectedScreenSharer({ idx: null, participant: null });
    //   return;
    // }
  }

  useEffect(() => {
    const backAction = () => {
      if (fullScreenMode === true) {
        handleBackPress();
        return true;
      }
      return false;
    };

    const backHandler = BackHandler.addEventListener(
      'hardwareBackPress',
      backAction,
    );

    return () => backHandler.remove();
  }, [fullScreenMode]);

  return (
    <View style={{ flex: 1, width: '100%', backgroundColor: 'black' }}>
      {/* {!renderFullScreen && (
        <CallHeader
          callModalState={callModalState}
          closeModal={closeModal}
          fullScreenMode={fullScreenMode}
          openModal={openModal}
          seconds={1}
          setFullScreenMode={setFullScreenMode}
          setOptionsModal={setOptionsModal}
          setSelectedUser={setSelectedUser}
          onBackPress={() => {
            handleBackButton();
          }}
        />
      )} */}
      <>
        <View style={{ flex: 1 }}>{renderParticipantsGrid()}</View>
        {/* <MyComponent
          callDetails={callDetails}
          isScreenSharing={mediaProducers.producers.isScreenSharing}
          setFullScreenMode={setFullScreenMode}
        /> */}
      </>

      <CallButtons />
    </View>
  );
};

//make this component available to the app
export default OngoingCall;

const styles = StyleSheet.create({
  gridContainer: {
    flex: 1,
    height: Dimensions.get('window').height, // or a fixed height if needed
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
    // height: '50%',
  },
  fullWidthTile: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  buttonContainer1: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    right: 10,
    zIndex: zIndex.level_4,
    paddingHorizontal: 10,
  },
  iconStyle: {
    width: 40,
    height: 40,
  },
  iconStyle1: {
    width: 24,
    height: 24,
  },
});

const formatTime = (totalSeconds: any) => {
  const mins = Math.floor(totalSeconds / 60)
    .toString()
    .padStart(1, '0');
  const secs = (totalSeconds % 60).toString().padStart(2, '0');
  return `${mins}:${secs}`;
};

const headerStyle = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    // gap: 15,
  },
  selectedView: {
    backgroundColor: colors._7155C3_purple,
    paddingVertical: 10,
    paddingHorizontal: 25,
    borderRadius: 50,
  },
  tabIcon: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  iconStyle: {
    height: 20,
    width: 20,
    resizeMode: 'contain',
  },
  tabText: {
    ...commonFontStyle(500, 16, colors.white),
  },
  headerMainView: {
    paddingLeft: hp(2),
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    // paddingVertical: hp(1.5),
    height: hp(8),
  },
  moreMenu: {
    padding: hp(2),
  },
  moreMenuStyle: {
    height: 16,
    width: 16,
    resizeMode: 'contain',
  },
  headerBackView: {
    height: 18 + hp(2),
    width: 18 + hp(4),
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerBackIcon: {
    height: 20,
    width: 20,
    resizeMode: 'contain',
    transform: [{ rotate: '180deg' }],
  },
});

type CallHeaderProps = {
  fullScreenMode: boolean;
  setFullScreenMode: React.Dispatch<React.SetStateAction<boolean>>;
  callModalState: CallScreenModals;
  openModal: (modal: CallScreenModalKey) => void;
  closeModal: (modal: CallScreenModalKey) => void;
  // setOptionsModal: React.Dispatch<React.SetStateAction<boolean>>;
  setSelectedUser: React.Dispatch<React.SetStateAction<SelectedUser>>;
  seconds: number;
  onBackPress: () => void;
};

// function CallHeader({
//   fullScreenMode,
//   openModal,
//   closeModal,
//   callModalState,
//   // setOptionsModal,
//   setFullScreenMode,
//   setSelectedUser,
//   seconds,
//   onBackPress,
// }: CallHeaderProps) {
//   const { callDetails } = useCallContext();

//   const RightSideView = () => {
//     return (
//       <View
//         style={[
//           styles.buttonContainer1,
//           {
//             display: callDetails?.state == 'ongoing' ? 'flex' : 'none',
//             gap: 20,
//           },
//         ]}
//       >
//         {callDetails.type === 'audio' && (
//           <TouchableOpacity
//             onPress={async () => {
//               let resp = await requestCameraPermission();
//               if (resp === PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN) {
//                 ToastAndroid.show(
//                   'Please enable camera permission in settings',
//                   ToastAndroid.SHORT,
//                 );
//                 return;
//               }
//               if (resp !== 'granted') {
//                 ToastAndroid.show(
//                   'Camera permission denied',
//                   ToastAndroid.SHORT,
//                 );
//                 return false;
//               }
//               openModal('showSwitchToVideoRequest');
//             }}
//             style={{ display: callDetails?.type == 'audio' ? 'flex' : 'none' }}
//           >
//             {/* <Image source={IMAGES.videonew} style={styles.iconStyle} /> */}
//           </TouchableOpacity>
//         )}
//         <TouchableOpacity
//           onPress={() => {
//             callModalState.showAddPeople
//               ? closeModal('showAddPeople')
//               : openModal('showAddPeople');
//           }}
//         >
//           <Image source={IMAGES.addUser} style={styles.iconStyle} />
//         </TouchableOpacity>
//         <TouchableOpacity
//           style={{
//             padding: 10,
//           }}
//           onPress={() => {
//             setOptionsModal(true);
//             10;
//           }}
//         >
//           <ThreeDotsSVG size={18} />
//         </TouchableOpacity>
//       </View>
//     );
//   };
//   return (
//     <View
//       style={[
//         headerStyle.header,
//         {
//           position: 'absolute',
//           top: 20,
//           width: '100%',
//           zIndex: zIndex.level_2,
//         },
//       ]}
//     >
//       <View style={{ flexDirection: 'row', alignItems: 'center' }}>
//         <TouchableOpacity
//           onPress={() => {
//             onBackPress && onBackPress();
//           }}
//           style={headerStyle.headerBackView}
//         >
//           <FontAwesome6Icons name="arrow-left-long" size={20} color="#FFFFFF" />
//         </TouchableOpacity>
//         <TouchableOpacity style={headerStyle.header}>
//           <View style={{}}>
//             <View
//               style={{
//                 flexDirection: 'row',
//                 gap: 10,
//                 display:
//                   callDetails?.state == 'ongoing' &&
//                   callDetails?.participants?.length > 1
//                     ? 'flex'
//                     : 'none',
//                 top: 3,
//               }}
//             >
//               <Text style={{ ...commonFontStyle(600, 16, colors.white) }}>
//                 {callDetails?.participants?.length > 1
//                   ? `Group ${
//                       callDetails?.type === 'audio' ? 'audio' : 'video'
//                     } call`
//                   : ''}
//                 {callDetails?.participants?.length > 1 &&
//                   ' (' + Number(callDetails?.participants?.length) + ')'}
//               </Text>
//             </View>

//             {callDetails?.state == 'ongoing' &&
//               callDetails?.participants?.length > 1 && (
//                 <Text
//                   style={{
//                     ...commonFontStyle(600, 13, colors.white),
//                     marginTop: 10,
//                   }}
//                 >
//                   {formatTime(seconds)}
//                 </Text>
//               )}
//           </View>
//         </TouchableOpacity>
//       </View>
//       {RightSideView()}
//     </View>
//   );
// }
