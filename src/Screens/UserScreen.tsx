import { IUser, userList } from '../types/user.type';
import { UserContext } from '../context/userProvider';

import React, { FC } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { useContext } from 'react';
import { useCallContext } from '../context/CallProvider';
import { StartCallParams } from '../types/calls.types';
import useSocket from '../socket-client/useSocket';
import { useLocation } from '../context/LocationProvider';

const UserScreen: FC = () => {
  const { user } = useContext(UserContext);

  const { socket } = useSocket();

  const { remoteLocation } = useLocation();

  console.log(remoteLocation, 'remoteLocation');

  const filteredUsers = userList.filter(u => u.id !== user?.id);

  const renderItem = ({ item }: { item: IUser }) => <UserItem user={item} />;

  return (
    <View style={styles.container}>
      {/* Current User */}
      <Text style={styles.header}>Hello, {user?.name || 'User'} 👋</Text>
      <Text style={styles.subText}>Select another user to call with:</Text>
      <View
        style={{
          marginTop: 20,
          backgroundColor: socket?.connected ? 'green' : 'red',
          padding: 10,
          borderRadius: 5,
        }}
      >
        <Text style={{ color: socket?.connected ? 'white' : 'black' }}>
          {' '}
          Socket Status: {socket?.connected ? 'Connected' : 'Disconnected'}{' '}
        </Text>
      </View>
      {/* User List */}
      <FlatList
        data={filteredUsers}
        renderItem={renderItem}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.listContainer}
        style={{
          top: 30,
        }}
      />

      {remoteLocation && (
        <View
          style={{
            position: 'absolute',
            bottom: 100,
            width: '100%',
            marginHorizontal: 'auto',
            padding: 10,
          }}
        >
          <Text>Remote Location:</Text>
          <Text>
            {remoteLocation.latitude}, {remoteLocation.longitude} from{' '}
            {remoteLocation.username}
          </Text>
        </View>
      )}
    </View>
  );
};

const UserItem: FC<{ user: IUser }> = ({ user }) => {
  const { startCall } = useCallContext();
  const { user: selfUser } = useContext(UserContext);

  const { startLocationSharing, stopLocationSharing, isSharing } =
    useLocation();

  const handleStartCall = () => {
    const payload: StartCallParams = {
      callType: 'audio',
      origin: { type: 'directConversation', conversationId: '' },
      recipients: [{ ...user }],
    };
    startCall(payload);
  };

  const handleShareLocation = () => {
    if (isSharing) {
      stopLocationSharing();
    } else {
      startLocationSharing(user.id, selfUser?.name || '');
    }
  };

  return (
    <View style={styles.userItem}>
      <View>
        <Text style={styles.username}>{user.name}</Text>
        <Text style={styles.bio}>{user.bio}</Text>
      </View>

      <View style={styles.buttonRow}>
        <TouchableOpacity
          style={[styles.button, styles.callButton]}
          onPress={handleStartCall}
        >
          <Text style={styles.buttonText}>Call</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.button, styles.shareButton]}
          onPress={handleShareLocation}
        >
          <Text style={styles.buttonText}>
            {isSharing ? 'Stop sharing' : 'Share location'}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  userItem: {
    backgroundColor: '#fff',
    padding: 16,
    marginBottom: 12,
    borderRadius: 14,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 6,
    elevation: 3,
  },
  username: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1f2937',
  },
  bio: {
    fontSize: 14,
    color: '#6b7280',
    marginTop: 4,
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 12,
  },
  button: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
    marginHorizontal: 5,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowOffset: { width: 0, height: 3 },
    shadowRadius: 4,
    elevation: 2,
  },
  callButton: {
    backgroundColor: '#10b981', // green
  },
  shareButton: {
    backgroundColor: '#3b82f6', // blue
  },
  buttonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 15,
  },
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
    padding: 20,
    paddingTop: 50,
  },
  header: {
    fontSize: 22,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 4,
  },
  subText: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 20,
  },
  listContainer: {
    paddingBottom: 20,
  },
});

export default UserScreen;
