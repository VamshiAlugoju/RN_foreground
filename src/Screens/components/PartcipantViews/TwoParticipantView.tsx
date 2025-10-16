import CallMemberTile from '../CallMembertile';
import { CallDetails, Participant } from '../../../types/calls.types';

import React from 'react';
import { StyleSheet, View } from 'react-native';

type Props = {
  participants: Participant[];
  callDetails: CallDetails;
  selectUser: (participant: Participant, idx: number) => void;
  fullScreenMode: boolean;
};

const TwoParticipantView: React.FC<Props> = ({
  participants,
  callDetails,
  selectUser,
  fullScreenMode,
}) => (
  <View style={styles.twoParticipantsContainer}>
    {participants.map((participant, index) => (
      <View key={index} style={styles.halfScreenParticipant}>
        <CallMemberTile
          callDetails={callDetails}
          participent={participant}
          key={participant.participantId}
          idx={index}
          isScreenSharing={false}
          selectUser={selectUser}
        />
      </View>
    ))}
  </View>
);

export default TwoParticipantView;

const styles = StyleSheet.create({
  twoParticipantsContainer: {
    flex: 1,
    flexDirection: 'column',
  },
  halfScreenParticipant: {
    flex: 1,
    width: '100%',
  },
});
