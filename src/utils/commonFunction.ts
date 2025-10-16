import { nanoid } from 'nanoid/non-secure';

import {
  Alert,
  Platform,
  Keyboard,
  ToastAndroid,
  InteractionManager,
} from 'react-native';

let keyboardVisible = false;

Keyboard.addListener('keyboardDidShow', () => {
  keyboardVisible = true;
});
Keyboard.addListener('keyboardDidHide', () => {
  keyboardVisible = false;
});

export const generateUUID = (length: number = 20) => {
  return nanoid(length);
};

export const successToast = (message: string) => {
  ToastAndroid.show(message, ToastAndroid.SHORT);
};

export const errorToast = (message: string) => {
  ToastAndroid.show(message, ToastAndroid.SHORT);
};

export const infoToast = (message: string) => {
  ToastAndroid.show(message, ToastAndroid.SHORT);
};
