import { Alert, PermissionsAndroid, Platform } from 'react-native';

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


