import React, { useEffect, useState, createContext } from 'react';
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

  // Helper to set user in state + storage
  const setUser = async (newUser: IUser) => {
    setUserState(newUser);
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
