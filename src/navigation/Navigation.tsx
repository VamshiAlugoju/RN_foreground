import {
  createNativeStackNavigator,
  NativeStackNavigationOptions,
} from '@react-navigation/native-stack';
import { FC, useState } from 'react';
import MainScreen from '../Screens/MainScreen';
import UserScreen from '../Screens/UserScreen';
import { NavigationContainer } from '@react-navigation/native';
import { StatusBar } from 'react-native';
import { View } from 'react-native';
import LocationDebugScreen from '../Screens/LocationDebugScreen';

const Stack = createNativeStackNavigator();

export const StackNavigator: FC = () => {
  const [initialScreen, setInitialScreen] = useState<string>('MainScreen');

  const screenOptions: NativeStackNavigationOptions = {
    gestureDirection: 'horizontal' as const,

    headerShown: false,
    animation: 'simple_push',
    animationDuration: 1,
    animationTypeForReplace: 'push',
  };

  return (
    <Stack.Navigator
      initialRouteName={initialScreen}
      screenOptions={screenOptions}
    >
      <Stack.Screen name={Screens.MainScreen} component={MainScreen} />
      <Stack.Screen name={Screens.UserScreen} component={UserScreen} />
      <Stack.Screen name={Screens.LocationDebug} component={LocationDebugScreen} />
    </Stack.Navigator>
  );
};

export const Screens = {
  MainScreen: 'MainScreen',
  UserScreen: 'UserScreen',
  LocationDebug: 'LocationDebug',
};

const RootContainer: FC = () => {
  const linking = {
    prefixes: ['foreground://'],
    config: {
      screens: {
        [Screens.LocationDebug]: 'location',
      },
    },
  };
  return (
    <NavigationContainer linking={linking}>
      <StatusBar
        barStyle="light-content"
        backgroundColor={'white'}
        translucent={true}
      />

      <View style={{}}>{/* <CallOverlay /> */}</View>
      <StackNavigator />
    </NavigationContainer>
  );
};

export default RootContainer;
