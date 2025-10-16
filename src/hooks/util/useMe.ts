import { useContext, useEffect, useState } from 'react';
import { UserContext } from '../../context/userProvider';

export const useMe = () => {
  const userContext = useContext(UserContext);
  if (!userContext) {
    throw new Error('useMe must be used within a UserProvider');
  }
  return userContext;
};
