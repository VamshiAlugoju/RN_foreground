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

const ThreeParticipantView: React.FC<Props> = ({
  participants,
  callDetails,
  selectUser,
  fullScreenMode,
}) => (
  <View style={styles.threeParticipantsContainer}>
    <View style={styles.firstRow}>
      <View style={styles.halfWidthTile}>
        <CallMemberTile
          callDetails={callDetails}
          participent={participants[0]}
          idx={0}
          key={participants[0].participantId}
          isScreenSharing={false}
          selectUser={selectUser}
        />
      </View>
      <View style={styles.halfWidthTile}>
        <CallMemberTile
          callDetails={callDetails}
          participent={participants[1]}
          idx={1}
          key={participants[1].participantId}
          isScreenSharing={false}
          selectUser={selectUser}
        />
      </View>
    </View>
    <View style={styles.secondRow}>
      <View style={styles.fullWidthTile}>
        <CallMemberTile
          callDetails={callDetails}
          participent={participants[2]}
          idx={2}
          key={participants[2].participantId}
          isScreenSharing={false}
          selectUser={selectUser}
        />
      </View>
    </View>
  </View>
);

export default ThreeParticipantView;

const styles = StyleSheet.create({
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
  threeParticipantsContainer: {
    flex: 1,
    width: '100%',
  },
  firstRow: {
    flex: 1,
    flexDirection: 'row',
    width: '100%',
  },
});
