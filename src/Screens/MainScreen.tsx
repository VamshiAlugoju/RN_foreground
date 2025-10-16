import React, { FC } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  StyleSheet,
} from 'react-native';
import { userList, IUser } from '../types/user.type';
import useSocket from '../socket-client/useSocket';
import { useNavigation } from '@react-navigation/native';
import { Screens } from '../navigation/Navigation';

const MainScreen: FC = () => {
  const { connectSocket } = useSocket();
  const navigation = useNavigation();
  const handleLogin = async (user: IUser) => {
    try {
      console.log('Selected user:', user.username);
      // navigate or setUser(user)
      await connectSocket(user);
      navigation.navigate(Screens.UserScreen);
    } catch (err) {
      console.log(err);
    }
  };

  const renderItem = ({ item }: { item: IUser }) => (
    <UserCard user={item} onPress={() => handleLogin(item)} />
  );

  return (
    <View style={styles.container}>
      <View style={styles.headerContainer}>
        <Text style={styles.title}>Select a user to login</Text>
        <Text style={styles.subtitle}>
          Do not try to login as same user in two different devices.
        </Text>
      </View>

      <FlatList
        data={userList}
        keyExtractor={item => item.id}
        renderItem={renderItem}
        contentContainerStyle={styles.listContent}
      />
    </View>
  );
};

export default MainScreen;

const UserCard: FC<{ user: IUser; onPress: () => void }> = ({
  user,
  onPress,
}) => (
  <TouchableOpacity activeOpacity={0.8} onPress={onPress} style={styles.card}>
    <Text style={styles.name}>{user.name}</Text>
    <Text style={styles.username}>@{user.username}</Text>
    <Text style={styles.bio}>{user.bio}</Text>
  </TouchableOpacity>
);

/** 🎨 Styles */
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
    padding: 20,
    paddingTop: 60,
  },
  headerContainer: {
    marginBottom: 20,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
  },
  listContent: {
    paddingBottom: 40,
  },
  card: {
    backgroundColor: 'white',
    paddingVertical: 18,
    paddingHorizontal: 20,
    borderRadius: 16,
    marginBottom: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  name: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },
  username: {
    fontSize: 13,
    color: '#6b7280',
    marginTop: 2,
  },
  bio: {
    fontSize: 12,
    color: '#9ca3af',
    marginTop: 4,
  },
});
