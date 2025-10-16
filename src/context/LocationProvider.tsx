import React, {
  createContext,
  useState,
  useRef,
  useContext,
  useEffect,
} from 'react';
import useSocket from '../socket-client/useSocket';
import { ToastAndroid } from 'react-native';

type Location = {
  latitude: number;
  longitude: number;
};

type LocationContextType = {
  remoteLocation: locationPayload | null;
  isSharing: boolean;
  startLocationSharing: (recieverId: string, username: string) => void;
  stopLocationSharing: () => void;
};

const LocationContext = createContext<LocationContextType | undefined>(
  undefined,
);

type locationPayload = {
  recieverId: string;
  latitude: number;
  longitude: number;
  username: string;
};

export const LocationProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const { socket } = useSocket();

  const [remoteLocation, setRemoteLocation] = useState<locationPayload | null>(
    null,
  );
  const [isSharing, setIsSharing] = useState(false);
  const [recipentInfo, setRecipentInfo] = useState<{
    recieverId: string;
    username: string;
  } | null>(null);

  // ✅ ref to always hold latest recipient info
  const recipentRef = useRef<{ recieverId: string; username: string } | null>(
    null,
  );
  useEffect(() => {
    recipentRef.current = recipentInfo;
  }, [recipentInfo]);

  const onLocationUpdate = (location: Location) => {
    if (!socket || socket.connected === false) return;

    if (!recipentRef.current) return;
    socket.emit('shareLocation', {
      recieverId: recipentRef.current?.recieverId,
      latitude: location.latitude,
      longitude: location.longitude,
      username: recipentRef.current?.username,
    } as locationPayload);
    console.log('Location shared');
  };

  const { location, startMockLocation, stopMockLocation } = useMockLocation({
    freq: 2000,
  });

  const startLocationSharing = (recieverId: string, username: string) => {
    if (isSharing) return;

    if (!socket || socket.connected === false) {
      ToastAndroid.show('Socket is not connected', ToastAndroid.SHORT);
      return;
    }

    setIsSharing(true);
    setRecipentInfo({ recieverId, username });
    startMockLocation(onLocationUpdate);
  };

  const stopLocationSharing = () => {
    setIsSharing(false);
    setRecipentInfo(null);
    stopMockLocation();
  };

  const timerRef = useRef<NodeJS.Timeout | null>(null);
  useEffect(() => {
    if (socket.connected) {
      socket.on('onLocationUpdate', (data: locationPayload) => {
        console.log('recieved location:', data);
        setRemoteLocation({
          latitude: data.latitude,
          longitude: data.longitude,
          recieverId: data.recieverId,
          username: data.username,
        });
        console.log('remote location:', remoteLocation);
        if (timerRef.current) {
          clearTimeout(timerRef.current);
        }

        // if not contiu
        timerRef.current = setTimeout(() => {
          setRemoteLocation(null);
          clearTimeout(timerRef.current);
          ToastAndroid.show('Location ended', ToastAndroid.SHORT);
        }, 5000);
        console.debug('remote location: timer has been set', remoteLocation);
      });
    }
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
      socket.off('onLocationUpdate');
    };
  }, [socket.connected]);

  return (
    <LocationContext.Provider
      value={{
        remoteLocation,
        isSharing,
        startLocationSharing,
        stopLocationSharing,
      }}
    >
      {children}
    </LocationContext.Provider>
  );
};

// Hook for easy access
export const useLocation = () => {
  const ctx = useContext(LocationContext);
  if (!ctx) {
    throw new Error('useLocation must be used within a LocationProvider');
  }
  return ctx;
};

type options = {
  freq: number;
};

function useMockLocation(options: options) {
  const { freq } = options;
  const [location, setLocation] = useState<Location | null>(null);

  const intervalRef = useRef<NodeJS.Timer | null>(null);

  const startMockLocation = (
    onLocationUpdate: (location: Location) => void,
  ) => {
    if (intervalRef.current) return;
    intervalRef.current = setInterval(() => {
      const lat = Math.random() * 180 - 90;
      const lon = Math.random() * 360 - 180;
      setLocation({ latitude: lat, longitude: lon });
      if (onLocationUpdate) {
        onLocationUpdate({ latitude: lat, longitude: lon });
      }
    }, freq);
  };

  const stopMockLocation = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  };

  useEffect(() => {
    return () => {
      stopMockLocation();
    };
  }, []);

  return {
    startMockLocation,
    location,
    stopMockLocation,
  };
}
