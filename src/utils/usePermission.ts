import { Alert, PermissionsAndroid, Platform, ToastAndroid } from 'react-native';

export const requestStoragePermission = async (): Promise<boolean> => {
  if (Platform.OS === 'android') {
    try {
      const sdkInt = parseInt(Platform.constants?.Release || '0', 10);
      if (sdkInt >= 13) {
        const granted = await PermissionsAndroid.requestMultiple([
          PermissionsAndroid.PERMISSIONS.READ_MEDIA_IMAGES,
          PermissionsAndroid.PERMISSIONS.READ_MEDIA_VIDEO,
          PermissionsAndroid.PERMISSIONS.READ_MEDIA_AUDIO,
        ]);
        const allGranted = Object.values(granted).every(
          status => status === PermissionsAndroid.RESULTS.GRANTED,
        );

        if (!allGranted) {
          Alert.alert(
            'Permission Required',
            'Media permissions are required to download files.',
          );
          return false;
        }
        return true;
      } else {
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE,
          {
            title: 'External Storage Write Permission',
            message: 'App needs write permission to save files',
            buttonPositive: 'OK',
          },
        );
        if (granted !== PermissionsAndroid.RESULTS.GRANTED) {
          Alert.alert(
            'Permission Denied',
            'Cannot proceed without storage permission.',
          );
          return false;
        }
        return true;
      }
    } catch (err: any) {
      console.warn('Permission error:', err);
      Alert.alert('Error', 'Failed to request permissions');
      return false;
    }
  }
  return true;
};

export const requestCameraPermission = async () => {
  if (Platform.OS === 'android') {
    const granted = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.CAMERA,
      {
        title: 'Camera Permission',
        message: 'We need access to your camera to take photos and videos',
        buttonPositive: 'OK',
        buttonNegative: 'Cancel',
      },
    );

    return granted;
  }

  // For iOS (using react-native-permissions)
  if (Platform.OS === 'ios') {
    // const permission = await request(PERMISSIONS.IOS.CAMERA);
    // if (permission === RESULTS.GRANTED) {
    //   console.log('Camera permission granted');
    // } else {
    //   consoe.log('Camera permission denied');
    // }
  }
};

export const requestMicrophonePermission = async (): Promise<boolean> => {
  if (Platform.OS === 'android') {
    try {
      const granted = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
        {
          title: 'Microphone Permission',
          message: 'This app needs microphone access to make and receive calls. The app will not work properly without this permission.',
          buttonPositive: 'Allow',
          buttonNegative: 'Deny',
        },
      );
      
      if (granted === PermissionsAndroid.RESULTS.GRANTED) {
        console.log('Microphone permission granted');
        return true;
      } else {
        console.log('Microphone permission denied');
        ToastAndroid.show(
          'Microphone permission is required for calls. The app will not work without it.',
          ToastAndroid.LONG
        );
        return false;
      }
    } catch (err: any) {
      console.warn('Microphone permission error:', err);
      ToastAndroid.show(
        'Failed to request microphone permission. The app will not work properly.',
        ToastAndroid.LONG
      );
      return false;
    }
  }

  if (Platform.OS === 'ios') {
    // iOS implementation would go here
    return true;
  }
  
  return true;
};

// Android 13+ runtime notification permission
export const requestNotificationPermission = async (): Promise<boolean> => {
  try {
    if (Platform.OS !== 'android') return true;
    // On Android, Platform.Version is the API level (33 = Android 13)
    const apiLevel = typeof Platform.Version === 'number' ? Platform.Version : parseInt(String(Platform.Version), 10);
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
    return true; // Do not block if something goes wrong
  }
};
