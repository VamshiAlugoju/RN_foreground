import AsyncStorage from '@react-native-async-storage/async-storage';
// import { asyncKeys } from '../utils/asyncStorage';
import { asyncKeys } from '../utils/asyncStorage';
import { IUser } from '../types/index.types';

// Helper to convert dates to string consistently
const stringifyDate = (value: Date | string): string =>
  value instanceof Date ? value.toISOString() : value;

const stringify = (value: any): string => JSON.stringify(value);

// AsyncStorage wrapper utilities
const Storage = {
  get: async (key: string): Promise<string | null> =>
    await AsyncStorage.getItem(key),
  set: async (key: string, value: string): Promise<void> =>
    await AsyncStorage.setItem(key, value),
  remove: async (key: string): Promise<void> =>
    await AsyncStorage.removeItem(key),
};

// Namespaced storage handlers

// Used to sync messages after offline period
const LastSyncedDate = {
  get: async (): Promise<string | null> =>
    await Storage.get(asyncKeys.lastSynced),
  set: async (lastSynced: Date | string): Promise<void> =>
    await Storage.set(asyncKeys.lastSynced, stringifyDate(lastSynced)),
  clear: async (): Promise<void> => await Storage.remove(asyncKeys.lastSynced),
};

// Access token (JWT)
const AuthToken = {
  get: async (): Promise<string | null> => await Storage.get(asyncKeys.token),
  set: async (token: string): Promise<void> =>
    await Storage.set(asyncKeys.token, token),
  clear: async (): Promise<void> => await Storage.remove(asyncKeys.token),
};

// Holds user meta data
const User = {
  get: async (): Promise<IUser | null> => {
    const user = await Storage.get(asyncKeys.user_info);
    return user ? JSON.parse(user) : null;
  },
  set: async (user: IUser): Promise<void> =>
    await Storage.set(asyncKeys.user_info, stringify(user)),
  clear: async (): Promise<void> => await Storage.remove(asyncKeys.user_info),
};

const getBearerToken = (token: string | null): string | null => {
  return token ? `Bearer ${token}` : null;
};

// Export with namespaces
export const Client = {
  LastSyncedDate,
  AuthToken,
  User,
  getBearerToken,
};
