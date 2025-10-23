import React, {
  createContext,
  useState,
  useRef,
  useContext,
  useEffect,
} from 'react';
import useSocket from '../socket-client/useSocket';
import { ToastAndroid } from 'react-native';
import { locationForegroundService as foregroundService } from '../services/foreground/ForegroundService';
import { useMe } from '../hooks/util/useMe';

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
  const { user } = useMe();

  

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

  // Location sharing is now handled by native service

  // Mock location is now handled by native service

  const startLocationSharing = async (recieverId: string, username: string) => {
    if (isSharing) return;

    if (!socket || socket.connected === false) {
      ToastAndroid.show('Socket is not connected', ToastAndroid.SHORT);
      return;
    }

    setIsSharing(true);
    setRecipentInfo({ recieverId, username });
    
    // Get session data for native service
    try {
      if (!user?.accessToken) {
        ToastAndroid.show('User not authenticated', ToastAndroid.SHORT);
        return;
      }
      
      const authToken = user.accessToken;
      const socketUrl = 'https://test-server.chatbucket.chat/'; // From socket.ts
      
      // Start native foreground service with session data
      foregroundService.start('Location sharing active', 'Tap to return to app', {
        socketUrl,
        authToken,
        userId: user.id,
        recieverId,
        username,
        intervalMs: 2000
      });
      
      console.log('Native location sharing service started');
    } catch (e) {
      console.log('Failed to start location foreground service:', e);
      ToastAndroid.show('Failed to start location sharing', ToastAndroid.SHORT);
    }
  };

  const stopLocationSharing = () => {
    setIsSharing(false);
    setRecipentInfo(null);
    
    // Stop native foreground service
    try {
      foregroundService.stop();
      console.log('Native location sharing service stopped');
    } catch (e) {
      console.log('Failed to stop location foreground service:', e);
    }
  };

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  
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
          if (timerRef.current) {
            clearTimeout(timerRef.current);
            timerRef.current = null;
          }
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

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

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
