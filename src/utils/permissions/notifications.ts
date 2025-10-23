import { PermissionsAndroid, Platform } from 'react-native';

export const requestNotificationPermission = async (): Promise<boolean> => {
  try {
    if (Platform.OS !== 'android') return true;
    const apiLevel =
      typeof Platform.Version === 'number'
        ? Platform.Version
        : parseInt(String(Platform.Version), 10);
    if (apiLevel >= 33) {
      const result = await PermissionsAndroid.request(
        // @ts-ignore - available on Android 13+
        PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS,
        {
          title: 'Notification Permission',
          message: 'Allow notifications to keep calls running in the background.',
          buttonPositive: 'Allow',
          buttonNegative: 'Deny',
        },
      );
      return result === PermissionsAndroid.RESULTS.GRANTED;
    }
    return true;
  } catch (e) {
    console.warn('requestNotificationPermission error:', e);
    return true;
  }
};


