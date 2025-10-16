import React from 'react';

import CallMemberTile from '../CallMembertile';
import { CallDetails, Participant } from '../../../types/calls.types';

import { StyleSheet, View } from 'react-native';

type Props = {
  participants: Participant[];
  callDetails: CallDetails;
  selectUser: (participant: Participant, idx: number) => void;
  fullScreenMode: boolean;
};

const SingleParticipantView: React.FC<Props> = ({
  participants,
  callDetails,
  selectUser,
  fullScreenMode,
}) => {
  const participant = participants[0];
  return (
    <View style={styles.fullScreenParticipant}>
      <CallMemberTile
        key={participants[0].participantId}
        callDetails={callDetails}
        participent={participants[0]}
        idx={0}
        isScreenSharing={false}
        selectUser={selectUser}
      />
    </View>
  );
};

export default SingleParticipantView;

const styles = StyleSheet.create({
  fullScreenParticipant: {
    flex: 1,
    width: '100%',
  },
});
