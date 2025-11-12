import { NativeModules, NativeEventEmitter } from 'react-native';

type NativeForegroundService = {
  startForegroundService?: (title: string, message: string) => void;
  stopForegroundService?: () => void;
};

// RNCGeolocation equivalent = LocationSharing
const { LocationSharing, CallService } = NativeModules as {
  LocationSharing?: NativeForegroundService & {
    startForegroundService: (
      title: string,
      message: string,
      socketUrl: string,
      authToken: string,
      userId: string,
      recieverId: string,
      username: string,
    ) => void;
    isServiceRunning: () => Promise<boolean>;
  };
  CallService?: NativeForegroundService;
};

function safeCall<T extends (...args: any[]) => any>(
  fn: T | undefined,
  ...args: Parameters<T>
) {
  try {
    if (typeof fn === 'function') {
      fn(...args);
    }
  } catch (e) {
    // Swallow native errors to avoid crashing UI; callers may log if needed
  }
}

type LocationSession = {
  socketUrl: string;
  authToken: string;
  userId: string;
  recieverId: string;
  username: string;
  intervalMs?: number;
};

// Create event emitter for location sharing events
const locationEventEmitter = LocationSharing
  ? new NativeEventEmitter(LocationSharing as any)
  : null;
export const locationForegroundService = {
  start(title: string, message: string, session?: LocationSession) {
    if (session) {
      safeCall(
        LocationSharing?.startForegroundService,
        title,
        message,
        session.socketUrl,
        session.authToken,
        session.userId,
        session.recieverId,
        session.username,
      );
    } else {
      safeCall(
        LocationSharing?.startForegroundService,
        title,
        message,
        '',
        '',
        '',
        '',
        '',
      );
    }
  },
  stop() {
    safeCall(LocationSharing?.stopForegroundService);
  },
  async isRunning(): Promise<boolean> {
    try {
      return (await LocationSharing?.isServiceRunning()) || false;
    } catch (e) {
      return false;
    }
  },
  // Event emitter for listening to native events
  getEventEmitter() {
    return locationEventEmitter;
  },
};

export const callForegroundService = {
  start(title: string, message: string) {
    safeCall(CallService?.startForegroundService as any, title, message);
  },
  stop() {
    safeCall(CallService?.stopForegroundService);
  },
};

export type { NativeForegroundService };
