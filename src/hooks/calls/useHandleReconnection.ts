import { useEffect } from 'react';
import { CallDetails, callsNotificationType } from '../../types/calls.types';
import { Socket } from 'socket.io-client';
import { callSocketEvents } from '../../socket-client/socketEvents';
import { clearPersistedCallDetails } from '../../calls/calls.lib';
type props = {
  answerCall({ roomId }: { roomId: string }): void;
  hideNotification: (type: keyof callsNotificationType) => void;
  resetCallDetails: () => void;
  currentCallDetails: CallDetails;
  cleanUpMediaTransports: () => Promise<void>;
  socket: Socket;
};
export function useHandleReconnection({
  answerCall,
  hideNotification,
  resetCallDetails,
  currentCallDetails,
  cleanUpMediaTransports,
  socket,
}: props) {
  function reconnectCall(roomId: string) {
    hideNotification('showReconnectCallPopup');
    socket.emit(
      callSocketEvents.CALL_STATUS,
      {
        roomId: roomId,
      },
      (data: { status: boolean; room?: any; message?: string }) => {
        if (!data.status) {
          clearPersistedCallDetails();
          return;
        }
        resetCallDetails();
        answerCall({ roomId: roomId });
      },
    );
  }
  useEffect(() => {
    const handleOnline = () => {
      if (currentCallDetails.state === 'ongoing') {
        reconnectCall(currentCallDetails.roomId);
      }
    };

    const handleOffline = () => {
      cleanUpMediaTransports();
    };

    // window.addEventListener("online", handleOnline);
    // window.addEventListener("offline", handleOffline);

    return () => {
      // window.removeEventListener("online", handleOnline);
      // window.removeEventListener("offline", handleOffline);
    };
  }, [currentCallDetails.state]);
  return {};
}
