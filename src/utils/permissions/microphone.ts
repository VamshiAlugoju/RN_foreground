import { PermissionsAndroid, Platform, ToastAndroid } from 'react-native';

export const requestMicrophonePermission = async (): Promise<boolean> => {
  if (Platform.OS === 'android') {
    try {
      const granted = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
        {
          title: 'Microphone Permission',
          message:
            'This app needs microphone access to make and receive calls. The app will not work properly without this permission.',
          buttonPositive: 'Allow',
          buttonNegative: 'Deny',
        },
      );

      if (granted === PermissionsAndroid.RESULTS.GRANTED) {
        return true;
      } else {
        ToastAndroid.show(
          'Microphone permission is required for calls. The app will not work without it.',
          ToastAndroid.LONG,
        );
        return false;
      }
    } catch (err: any) {
      console.warn('Microphone permission error:', err);
      ToastAndroid.show(
        'Failed to request microphone permission. The app will not work properly.',
        ToastAndroid.LONG,
      );
      return false;
    }
  }

  if (Platform.OS === 'ios') {
    return true;
  }

  return true;
};


