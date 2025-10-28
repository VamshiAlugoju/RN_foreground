import React, { useEffect, useState, createContext, useContext } from 'react';
import { IUser } from '../types/user.type';
import { Client } from '../lib/Client';
import { clearSocket } from '../socket-client/socket';
import AsyncStorage from '@react-native-async-storage/async-storage';

export const USER_KEY = 'cb_user_me';

export type UserContextType = {
  user: IUser | null;
  setUser: (user: IUser) => void;
  logout: () => void;
};

const initialVal: UserContextType = {
  user: null,
  setUser: (user: IUser) => {},
  logout: () => {},
};

export const UserContext = createContext<UserContextType>(initialVal);

export const UserProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [user, setUserState] = useState<IUser | null>(null);

  // Load user from storage on app startup
  useEffect(() => {
    const loadUserFromStorage = async () => {
      try {
        const storedUser = await Client.User.get();
        if (storedUser) {
          console.log('Loaded user from storage:', storedUser.id);
          setUserState(storedUser);
        } else {
          console.log('No user found in storage');
        }
      } catch (error) {
        console.log('Error loading user from storage:', error);
      }
    };

    loadUserFromStorage();
  }, []);

  // Helper to set user in state + storage
  const setUser = async (newUser: IUser) => {
    setUserState(newUser);
    await Client.User.set(newUser);
  };

  // Optional: cleanup sockets on logout or app exit
  const logout = async () => {
    clearSocket();
    setUserState(null);
  };

  return (
    <UserContext.Provider value={{ user, setUser, logout }}>
      {children}
    </UserContext.Provider>
  );
};
