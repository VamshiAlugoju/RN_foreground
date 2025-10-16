import { useState, useRef, useEffect } from 'react';

import { CallDetails } from '../../types/calls.types';

const defaultCallDetails: CallDetails = {
  callId: '',
  roomId: '',
  state: 'idle',
  type: 'audio',
  startedAt: undefined,
  duration: 0,
  isGroupCall: false,
  initialCallType: 'audio',
  isScreenSharing: false,
  participants: [],
  initiatorId: '',
  recipients: [],
  screenSharingState: 'idle',
  recipentList: [],
  initiatorDetails: null,
  origin: undefined,
  serverCallId: '',
  clientCallId: '',
};

interface UseCallState {
  currentCallDetails: CallDetails;
  setCurrentCallDetails: React.Dispatch<React.SetStateAction<CallDetails>>;
  callDetailsRef: React.MutableRefObject<CallDetails | null>;
  updateCallDetails: (partialCallDetails: Partial<CallDetails>) => void;
  resetCallDetails: () => void;
  getCallDetails: () => CallDetails | null;
  getParticipants: () => CallDetails['participants'];
  //new call
  showIncomingCallModal: () => void;
  hideIncomingCallModal: () => void;
  setNewCallDetails: React.Dispatch<React.SetStateAction<CallDetails>>;
  resetNewCallDetails: () => void;
  updateNewCallDetails: (partialCallDetails: Partial<CallDetails>) => void;
  getNewCallDetails: () => CallDetails | null;
  newIncomingCall: boolean;
}

function useCallState(): UseCallState {
  const [currentCallDetails, setCurrentCallDetails] = useState<CallDetails>(defaultCallDetails);
  const callDetailsRef = useRef<CallDetails | null>(null);

  const [newIncomingCall, setNewIncomingCall] = useState(false);
  const [newCallDetails, setNewCallDetails] = useState<CallDetails>(defaultCallDetails);
  const newCallDetailsRef = useRef<CallDetails | null>(null);

  useEffect(() => {
    newCallDetailsRef.current = newCallDetails;
  }, [newCallDetails]);

  useEffect(() => {
    callDetailsRef.current = currentCallDetails;
  }, [currentCallDetails]);

  const getCallDetails = () => {
    return callDetailsRef.current;
  };

  const updateCallDetails = (partialCallDetails: Partial<CallDetails>) => {
    setCurrentCallDetails((prev) => ({ ...prev, ...partialCallDetails }));
  };

  const resetCallDetails = () => {
    setCurrentCallDetails((prev) => {
      return {
        ...prev,
        ...defaultCallDetails,
      };
    });
  };

  const getParticipants = () => getCallDetails()?.participants ?? [];

  const showIncomingCallModal = () => {
    setNewIncomingCall(() => true);
  };

  const hideIncomingCallModal = () => {
    setNewIncomingCall(() => false);
  };

  const updateNewCallDetails = (partialCallDetails: Partial<CallDetails>) => {
    setNewCallDetails((prev) => ({ ...prev, ...partialCallDetails }));
  };
  const resetNewCallDetails = () => {
    setNewCallDetails(() => defaultCallDetails);
  };
  const getNewCallDetails = () => {
    return newCallDetailsRef.current;
  };
  return {
    currentCallDetails,
    setCurrentCallDetails,
    callDetailsRef,
    updateCallDetails,
    resetCallDetails,
    getCallDetails,
    getParticipants,
    showIncomingCallModal,
    hideIncomingCallModal,
    getNewCallDetails,
    setNewCallDetails,
    updateNewCallDetails,
    resetNewCallDetails,
    newIncomingCall,
  };
}

export default useCallState;
