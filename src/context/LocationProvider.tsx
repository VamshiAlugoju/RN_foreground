import React, {
  createContext,
  useState,
  useRef,
  useContext,
  useEffect,
} from 'react';
import useSocket from '../socket-client/useSocket';
import { ToastAndroid } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { locationForegroundService as foregroundService } from '../services/foreground/ForegroundService';
import { useMe } from '../hooks/util/useMe';


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

  // Load sharing state from AsyncStorage on mount
  useEffect(() => {
    loadSharingState();
  }, []);

  const loadSharingState = async () => {
    try {
      const savedState = await AsyncStorage.getItem('locationSharingState');
      if (savedState) {
        const { isSharing: savedIsSharing, recieverId: savedRecieverId, username: savedUsername } = JSON.parse(savedState);
        if (savedIsSharing) {
          setIsSharing(true);
          setRecipentInfo({ recieverId: savedRecieverId, username: savedUsername });
        }
      }
    } catch (e) {
      // Silent fail for storage errors
    }
  };

  const saveSharingState = async (isSharing: boolean, recieverId?: string, username?: string) => {
    try {
      if (isSharing && recieverId && username) {
        await AsyncStorage.setItem('locationSharingState', JSON.stringify({
          isSharing: true,
          recieverId,
          username
        }));
      } else {
        await AsyncStorage.removeItem('locationSharingState');
      }
    } catch (e) {
      // Silent fail for storage errors
    }
  };

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

    // Stop any existing location sharing service first
    try {
      foregroundService.stop();
    } catch (e) {
      // Service might not be running
    }

    // Set sharing state BEFORE starting new service
    setIsSharing(true);
    setRecipentInfo({ recieverId, username });
    
    // Save state to AsyncStorage
    await saveSharingState(true, recieverId, username);
    
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
      
    } catch (e) {
      ToastAndroid.show('Failed to start location sharing', ToastAndroid.SHORT);
      // Reset state if service start failed
      setIsSharing(false);
      setRecipentInfo(null);
    }
  };

  const stopLocationSharing = async () => {
    setIsSharing(false);
    setRecipentInfo(null);
    
    // Clear state from AsyncStorage
    await saveSharingState(false);
    
    // Stop native foreground service
    try {
      foregroundService.stop();
    } catch (e) {
      // Service might not be running
    }
  };

  // Handle user changes and cleanup
  useEffect(() => {
    const handleUserChange = async () => {
      // Only run if user ID exists (not on initial mount)
      if (user?.id) {
        setIsSharing(false);
        setRecipentInfo(null);
        await saveSharingState(false);
      }
    };

    // Run on user change
    handleUserChange();

    // Cleanup function
    return () => {
      // Stop location sharing when component unmounts or user changes
      if (isSharing) {
        try {
          foregroundService.stop();
        } catch (e) {
          // Service might not be running
        }
      }
    };
  }, [user?.id]); // Re-run when user changes

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  
  useEffect(() => {
    if (socket.connected) {
      socket.on('onLocationUpdate', (data: locationPayload) => {
        setRemoteLocation({
          latitude: data.latitude,
          longitude: data.longitude,
          recieverId: data.recieverId,
          username: data.username,
        });
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

