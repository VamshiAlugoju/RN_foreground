import AsyncStorage from '@react-native-async-storage/async-storage';

export const asyncKeys = {
  // clear in logout time
  token: '@token',
  user_info: '@user_info',
  isDownloaded: '@isDownloaded',

  isStoryCount: '@isStoryCount',
  isStoryViewed: '@isStoryViewed',
  isStoryPrivacy: '@isStoryPrivacy',

  // mediasoup
  displayMediaPerm: 'display_media_perm',

  // user information
  lastSynced: 'last_synced',
  stream_secret_key: 'stream_secret_key',
  // custom chat wallpaper
  customChatWallpaper: '@custom_chat_wallpaper',
  appLanguage: 'app_language',
};

export const clearAsync = async () => {
  await AsyncStorage.multiRemove([
    asyncKeys.token,
    asyncKeys.user_info,
    asyncKeys.isDownloaded,
  ]);
};

export const setAsyncToken = async (token: string) => {
  await AsyncStorage.setItem(asyncKeys.token, JSON.stringify(token));
};

export const getAsyncToken = async () => {
  try {
    const token = await AsyncStorage.getItem(asyncKeys.token);
    if (token) {
      return 'Bearer ' + JSON.parse(token);
    } else {
      return null;
    }
  } catch (err) {
    console.log(err);
  }
};

export const setAsyncUserInfo = async (user: any) => {
  await AsyncStorage.setItem(asyncKeys.user_info, JSON.stringify(user));
};

export const getAsyncUserInfo = async () => {
  const userInfo = await AsyncStorage.getItem(asyncKeys.user_info);
  if (userInfo) {
    return JSON.parse(userInfo);
  } else {
    return null;
  }
};

export const setAsyncStoryCount = async (value: any) => {
  await AsyncStorage.setItem(asyncKeys.isStoryCount, JSON.stringify(value));
};

export const getAsyncStoryCount = async () => {
  const userInfo = await AsyncStorage.getItem(asyncKeys.isStoryCount);
  if (userInfo) {
    return JSON.parse(userInfo);
  } else {
    return null;
  }
};

export const setAsyncViewStoryId = async (value: any) => {
  await AsyncStorage.setItem(asyncKeys.isStoryViewed, JSON.stringify(value));
};

export const getAsyncViewStoryId = async () => {
  const userInfo = await AsyncStorage.getItem(asyncKeys.isStoryViewed);

  if (userInfo) {
    return JSON.parse(userInfo);
  } else {
    return null;
  }
};

export const setAsyncStoryPrivacy = async (user: any) => {
  await AsyncStorage.setItem(asyncKeys.isStoryPrivacy, JSON.stringify(user));
};

export const getAsyncStoryPrivacy = async () => {
  const userInfo = await AsyncStorage.getItem(asyncKeys.isStoryPrivacy);

  if (userInfo) {
    return JSON.parse(userInfo);
  } else {
    return null;
  }
};

export const setStreamToken = async (token: string) => {
  await AsyncStorage.setItem(asyncKeys.stream_secret_key, token);
};

export const getStreamToken = async () => {
  const streamKey = await AsyncStorage.getItem(asyncKeys.stream_secret_key);
  return streamKey;
};

export const setAsyncCustomChatWallpaper = async (url: string) => {
  await AsyncStorage.setItem(
    asyncKeys.customChatWallpaper,
    JSON.stringify(url),
  );
};

export const getAsyncCustomChatWallpaper = async (): Promise<string | null> => {
  const url = await AsyncStorage.getItem(asyncKeys.customChatWallpaper);
  if (url) {
    return JSON.parse(url);
  } else {
    return null;
  }
};

export const getAppLanguage = async () => {
  const language = await AsyncStorage.getItem(asyncKeys.appLanguage);
  return language || 'eng';
};
