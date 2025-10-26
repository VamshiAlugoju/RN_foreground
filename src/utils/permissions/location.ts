import { Alert, PermissionsAndroid, Platform, ToastAndroid, Linking } from 'react-native';
import { requestNotificationPermission } from './notifications';

export const requestLocationBase = async (): Promise<boolean> => {
  const grants = await PermissionsAndroid.requestMultiple([
    PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
    PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION,
  ]);
  const ok = [
    grants[PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION],
    grants[PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION],
  ].every(v => v === PermissionsAndroid.RESULTS.GRANTED);
  if (!ok) {
    Alert.alert('Location Required', 'Please allow location access to share your live location.');
  }
  return ok;
};

export const requestBackgroundLocation = async (): Promise<boolean> => {
  try {
    if (Platform.OS !== 'android') return true;
    const apiLevel =
      typeof Platform.Version === 'number'
        ? Platform.Version
        : parseInt(String(Platform.Version), 10);
    if (apiLevel < 29) return true;
    const res = await PermissionsAndroid.request(
      // @ts-ignore
      PermissionsAndroid.PERMISSIONS.ACCESS_BACKGROUND_LOCATION,
      {
        title: 'Allow background location',
        message:
          'To keep sharing while the app is in background or after swiping it away, allow background location.',
        buttonPositive: 'Allow',
        buttonNegative: 'Deny',
      },
    );
    if (res !== PermissionsAndroid.RESULTS.GRANTED) {
      Alert.alert('Background Location Needed', 'Enable background location for uninterrupted sharing.');
      return false;
    }
    return true;
  } catch (e) {
    console.warn('requestBackgroundLocation error:', e);
    ToastAndroid.show('Failed to request background location', ToastAndroid.SHORT);
    return false;
  }
};



export const ensureLocationSharingPermissions = async (): Promise<boolean> => {
  try {
    if (Platform.OS !== 'android') return true;
    
    // 1. Request basic location permissions
    const base = await requestLocationBase();
    if (!base) return false;
    
    // 2. Request background location permission
    const bg = await requestBackgroundLocation();
    if (!bg) return false;
    
    // 3. Request notification permission
    await requestNotificationPermission();
    
    return true;
  } catch (e) {
    console.warn('ensureLocationSharingPermissions error:', e);
    return false;
  }
};


