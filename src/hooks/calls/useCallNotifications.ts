import { useState, useRef, RefObject } from 'react';
import { callsNotificationType } from '../../types/calls.types';

interface UseCallNotifications {
  callNotifications: callsNotificationType;

  showAddPeople: () => void;
  showScreenShareRequest: (screenSharer: any) => void;
  setWaitingForScreenShareApproval: (isWaiting: boolean) => void;

  closeNotifications: () => void;
  setScreenSharer: (sharer: any | undefined) => void;
  resetIncomingCallTimer: () => void;
  startIncomingCallTimer: (callback: () => void, delay?: number) => void;
  resetSwitchToVideoTimer: () => void;
  startSwitchToVideoTimer: (callback: () => void, delay?: number) => void;
  resetScreenShareRequestTimer: () => void;
  startScreenShareRequestTimer: (callback: () => void, delay?: number) => void;
  startAutoEndTimer: (callback: () => void, delay?: number) => void;
  resetAutoEndTimer: () => void;

  showCallNotification: (type: keyof callsNotificationType) => void;
  hideCallNotification: (type: keyof callsNotificationType) => void;
  timerRefs: RefObject<{
    showSwitchToVideoTimer: ReturnType<typeof setTimeout> | null;
  }>;

  startKeepCallAliveTimer: (callback: () => void, delay?: number) => void;
  resetKeepCallAliveTimer: () => void;
}

function useCallNotifications(): UseCallNotifications {
  const [callNotifications, setCallNotifications] = useState<callsNotificationType>({
    showSwitchToVideoPopup: false,
    showAddPeoplePopup: false,
    showScreenShareRequest: false,
    screenSharer: undefined,
    isWaitingForScreenShareApproval: false,
    showReconnectCallPopup: false,
  });

  const timerRefs = useRef<{ showSwitchToVideoTimer: ReturnType<typeof setTimeout> | null }>({
    showSwitchToVideoTimer: null,
  });
  const autoEndTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const incomingCallTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const switchToVideoTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const keepCallAliveTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const screenShareRequestTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showCallNotification = (type: keyof callsNotificationType) => {
    setCallNotifications((prev) => ({
      ...prev,
      [type]: true,
    }));
  };
  const hideCallNotification = (type: keyof callsNotificationType) => {
    setCallNotifications((prev) => ({
      ...prev,
      [type]: false,
    }));
  };

  const showAddPeople = () => {
    setCallNotifications((prev) => ({
      ...prev,
      showAddPeoplePopup: true,
    }));
  };

  const showScreenShareRequest = (screenSharer: any) => {
    setCallNotifications((prev) => ({
      ...prev,
      showScreenShareRequest: true,
      screenSharer,
    }));
  };

  const setWaitingForScreenShareApproval = (isWaiting: boolean) => {
    setCallNotifications((prev) => ({
      ...prev,
      isWaitingForScreenShareApproval: isWaiting,
    }));
  };

  const setScreenSharer = (sharer: any | undefined) => {
    setCallNotifications((prev) => ({
      ...prev,
      screenSharer: sharer,
    }));
  };

  const closeNotifications = () => {
    setCallNotifications({
      showSwitchToVideoPopup: false,
      showAddPeoplePopup: false,
      showScreenShareRequest: false,
      screenSharer: undefined,
      isWaitingForScreenShareApproval: false,
      showReconnectCallPopup: false,
    });
  };

  const resetIncomingCallTimer = () => {
    if (incomingCallTimer.current) {
      clearTimeout(incomingCallTimer.current);
      incomingCallTimer.current = null;
    }
  };
  const resetKeepCallAliveTimer = () => {
    if (keepCallAliveTimer.current) {
      clearInterval(keepCallAliveTimer.current);
      incomingCallTimer.current = null;
    }
  };

  const startIncomingCallTimer = (callback: () => void, delay = 30 * 1000) => {
    resetIncomingCallTimer();
    incomingCallTimer.current = setTimeout(callback, delay);
  };
  const startKeepCallAliveTimer = (callback: () => void, delay = 60 * 1000 * 5) => {
    resetKeepCallAliveTimer();
    keepCallAliveTimer.current = setInterval(callback, delay);
  };
  const startAutoEndTimer = (callback: () => void, delay = 30 * 1000) => {
    resetAutoEndTimer();
    autoEndTimer.current = setTimeout(callback, delay);
  };

  const resetAutoEndTimer = () => {
    if (autoEndTimer.current) {
      clearTimeout(autoEndTimer.current);
      autoEndTimer.current = null;
    }
  };

  const resetSwitchToVideoTimer = () => {
    if (switchToVideoTimer.current) {
      clearTimeout(switchToVideoTimer.current);
      switchToVideoTimer.current = null;
    }
  };

  const startSwitchToVideoTimer = (callback: () => void, delay = 10000) => {
    resetSwitchToVideoTimer();
    switchToVideoTimer.current = setTimeout(callback, delay);
  };

  const resetScreenShareRequestTimer = () => {
    if (screenShareRequestTimer.current) {
      clearTimeout(screenShareRequestTimer.current);
      screenShareRequestTimer.current = null;
    }
  };

  const startScreenShareRequestTimer = (callback: () => void, delay = 10000) => {
    resetScreenShareRequestTimer();
    screenShareRequestTimer.current = setTimeout(callback, delay);
  };

  return {
    callNotifications,

    showAddPeople,
    showScreenShareRequest,
    setWaitingForScreenShareApproval,

    closeNotifications,
    setScreenSharer,
    resetIncomingCallTimer,
    startIncomingCallTimer,
    resetSwitchToVideoTimer,
    startSwitchToVideoTimer,
    resetScreenShareRequestTimer,
    startScreenShareRequestTimer,
    startAutoEndTimer,
    resetAutoEndTimer,
    showCallNotification,
    hideCallNotification,
    startKeepCallAliveTimer,
    resetKeepCallAliveTimer,
    timerRefs,
  };
}

export default useCallNotifications;
