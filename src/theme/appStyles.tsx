import { StyleSheet } from 'react-native';
import { colors } from './colors';
import { hp, wp } from './fonts';

export const AppStyles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  mainWhiteContainer: {
    flex: 1,
    backgroundColor: colors.white,
  },
  purpleMainContainer: {
    flex: 1,
    backgroundColor: colors.mainPurple,
    justifyContent: 'space-between',
  },
  headerBackView: {
    height: 30,
    width: 46,
    backgroundColor: colors._7A5DCB_purple,
    borderRadius: 46 / 2,
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: hp(2),
  },
  headerBackIcon: {
    height: 20,
    width: 20,
    resizeMode: 'contain',
  },
  bottomWhiteView: {
    backgroundColor: colors.white,
    padding: hp(3),
    borderTopEndRadius: 20,
    borderTopStartRadius: 20,
  },
  bottomWhiteViewCall: {
    backgroundColor: colors.white,
    margin: hp(1),
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 15,
    borderRadius: 15,
    // borderTopEndRadius: 20,
    // borderTopStartRadius: 20,
  },
  bottomWhiteViewWithoutPadding: {
    backgroundColor: colors.white,
    borderTopEndRadius: 20,
    borderTopStartRadius: 20,
  },
  chatLogo: {
    height: wp(70),
    width: wp(70),
    resizeMode: 'contain',
    alignSelf: 'center',
  },
  chatLogo2: {
    height: wp(15),
    width: wp(15),
    resizeMode: 'contain',
    alignSelf: 'center',
    bottom: 30,
  },
  rightIconTextInput: {
    height: 15,
    width: 15,
    resizeMode: 'contain',
  },
  iconStyle20: {
    height: 20,
    width: 20,
    resizeMode: 'contain',
  },

  profileCard: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: hp(2),
    paddingVertical: hp(1.5),
    gap: hp(1.5),
  },

  baseText: {
    color: colors.black,
    fontSize: 16,
  },
});
