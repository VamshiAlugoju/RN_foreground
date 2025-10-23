import { PermissionsAndroid, Platform } from 'react-native';

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

  if (Platform.OS === 'ios') {
    // Implement via react-native-permissions if needed
  }
};


