import CallMemberTile from '../CallMembertile';
import { CallDetails, Participant } from '../../../types/calls.types';

import React from 'react';
import { Dimensions, FlatList, StyleSheet, View } from 'react-native';

type Props = {
  participants: Participant[];
  callDetails: CallDetails;
  selectUser: (participant: Participant, idx: number) => void;
  fullScreenMode: boolean;
};

const GridParticipantsView: React.FC<Props> = ({
  participants,
  callDetails,
  selectUser,
  fullScreenMode,
}) => (
  <View style={styles.gridContainer}>
    <FlatList
      data={participants}
      renderItem={({ item, index }) => {
        const isLastItem = index === participants.length - 1;
        const isOddCount = participants.length % 2 !== 0;
        const isEvenIndex = index % 2 === 0;

        const shouldSpanFullWidth = isLastItem && isOddCount && isEvenIndex;
        return (
          <View
            style={{
              width: shouldSpanFullWidth ? '100%' : '50%',
              height: Dimensions.get('screen').height / 2, // Adjust height
              margin: 1,
            }}
          >
            <CallMemberTile
              callDetails={callDetails}
              participent={item}
              idx={index}
              isScreenSharing={false}
              selectUser={selectUser}
            />
          </View>
        );
      }}
      numColumns={2}
      keyExtractor={item => item.participantId}
      scrollEnabled={participants.length > 4}
    />
  </View>
);

export default GridParticipantsView;

const styles = StyleSheet.create({
  gridContainer: {
    flex: 1,
    height: Dimensions.get('window').height, // or a fixed height if needed
    width: '100%',
  },
});
