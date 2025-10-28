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

/**
 * Requests the FOREGROUND_SERVICE_PHONE_CALL permission on Android 14+ (API 34)
 * This permission is required for foreground services with phoneCall type to function.
 * Must be granted before starting the call foreground service.
 */
export const requestForegroundServicePhoneCallPermission = async (): Promise<boolean> => {
  try {
    if (Platform.OS !== 'android') return true;
    const apiLevel =
      typeof Platform.Version === 'number'
        ? Platform.Version
        : parseInt(String(Platform.Version), 10);

    if (apiLevel >= 34) {
      const result = await PermissionsAndroid.request(
        // @ts-ignore - available on Android 14+
        'android.permission.FOREGROUND_SERVICE_PHONE_CALL',
        {
          title: 'Phone Call Service Permission',
          message: 'Allow background call services to stay active during calls.',
          buttonPositive: 'Allow',
          buttonNegative: 'Deny',
        },
      );
      return result === PermissionsAndroid.RESULTS.GRANTED;
    }
    return true;
  } catch (e) {
    console.warn('requestForegroundServicePhoneCallPermission error:', e);
    return true;
  }
};

