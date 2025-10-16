interface PartialPlatformConstants {
  Release?: string;
  Brand?: string;
  Model?: string;
}

const constants = Platform.constants as PartialPlatformConstants;
export const androidVersion = constants?.Release;

export function getFontType(fontWeight: any) {
  if (fontWeight == 600) {
    return Platform.OS == 'ios' ? 'SF Pro Text Semibold' : 'SF-Pro-Text-Semibold';
  } else if (fontWeight == 400) {
    return Platform.OS == 'ios' ? 'SF Pro Text Regular' : 'SF-Pro-Text-Regular';
  } else if (fontWeight == 700) {
    return Platform.OS == 'ios' ? 'SF Pro Text Bold' : 'SF-Pro-Text-Bold';
  } else if (fontWeight == 800) {
    return Platform.OS == 'ios' ? 'SF Pro Text Black' : 'SF-Pro-Text-Black';
  } else if (fontWeight == 500) {
    return Platform.OS == 'ios' ? 'SF Pro Text Medium' : 'SF-Pro-Text-Medium';
  } else if (fontWeight == 300) {
    return Platform.OS == 'ios' ? 'SF Pro Text Light' : 'SF-Pro-Text-Light';
  } else {
    return Platform.OS == 'ios' ? 'SF Pro Text Regular' : 'SF-Pro-Text-Regular';
  }
}

export const commonFontStyle = (fontWeight: any, fontSize: any, color: any) => {
  return {
    fontFamily: getFontType(fontWeight),
    fontSize: fontSize,
    color: color,
    includeFontPadding: false,
  };
};

export function hexToRgba(hex: any, opacity = 1) {
  // Remove "#" if present
  const sanitizedHex = hex.replace('#', '');

  // Parse shorthand hex (e.g. #abc => #aabbcc)
  const fullHex =
    sanitizedHex.length === 3
      ? sanitizedHex
          .split('')
          .map((char: any) => char + char)
          .join('')
      : sanitizedHex;

  const r = parseInt(fullHex.substring(0, 2), 16);
  const g = parseInt(fullHex.substring(2, 4), 16);
  const b = parseInt(fullHex.substring(4, 6), 16);

  return `rgba(${r}, ${g}, ${b}, ${opacity})`;
}

export function getLighterShade(color: string) {
  return hexToRgba(color, 0.15);
}

import { Dimensions, Platform, PixelRatio, StatusBar } from 'react-native';
import { heightPercentageToDP, widthPercentageToDP } from 'react-native-responsive-screen';

export const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

export const hp = (i: any) => {
  return heightPercentageToDP(i);
};

export const statusBarHeight = () => {
  const topNotchHeight = (Number(StatusBar.currentHeight) / SCREEN_HEIGHT) * 100;
  return topNotchHeight;
};

export const wp = (i: any) => {
  return widthPercentageToDP(i);
};
const scale = SCREEN_WIDTH / 320;

export function actuatedNormalize(size: any) {
  const newSize = size * scale;
  if (Platform.OS === 'ios') {
    return Math.round(PixelRatio.roundToNearestPixel(newSize));
  } else {
    return Math.round(PixelRatio.roundToNearestPixel(newSize)) - 2;
  }
}
