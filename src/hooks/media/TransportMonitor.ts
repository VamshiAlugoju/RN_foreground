import { types } from 'mediasoup-client';
import NetInfo, { NetInfoStateType } from '@react-native-community/netinfo';
import { getSocket } from '../../socket-client/socket';
import { mediaSocketEvents } from '../../socket-client/socketEvents';
import { Socket } from 'socket.io-client';

export type TransporterCallInfo = {
  roomId: string;
  participantId: string;
};

export type TransportMonitorOptions = {
  kind: 'producer' | 'consumer';
  transport: types.Transport;
  maxRetries?: number;
  onRestart?: () => Promise<void>;
  onRecreate?: () => Promise<void>;
  logger?: (msg: string) => void;
  //   callInfo: TransporterCallInfo;
};

export class TransportMonitor {
  private retries = 0;
  private options: TransportMonitorOptions;
  private iceGatheringState: types.IceGatheringState = 'new';
  private connectionState: types.ConnectionState = 'new';
  private unsubscribeNetInfo?: () => void;
  private lastNetworkType: string | null = null;

  constructor(options: TransportMonitorOptions) {
    this.options = options;
    this.watch();
    this.watchNetworkChanges();
  }

  private watch() {
    const { transport, kind, logger } = this.options;

    // 🔹 Transport connection state change
    transport.on('connectionstatechange', (state: types.ConnectionState) => {
      logger?.(`[${kind}] connection state -> ${state}`);
      this.connectionState = state;
      switch (state) {
        case 'disconnected':
          this.handleDisconnected();
          break;
        case 'failed':
          this.handleFailed();
          break;
        case 'closed':
          logger?.(`[${kind}] closed, stopping monitor`);
          break;
      }
    });

    transport.on('icecandidateerror', (e) => {
      logger?.(`[${kind}] icecandidateerror -> ${e}`);
    });

    transport.on('icegatheringstatechange', (state) => {
      logger?.(`[${kind}] icegatheringstatechange -> ${state}`);
      this.iceGatheringState = state;
    });
  }

  private watchNetworkChanges() {
    const { logger, onRestart } = this.options;

    this.unsubscribeNetInfo = NetInfo.addEventListener((state) => {
      const currentType = state.type; // 'wifi', 'cellular', 'none', etc.
      const isInternetReachable = state.isInternetReachable;
      if (
        this.lastNetworkType &&
        this.lastNetworkType !== currentType &&
        currentType !== NetInfoStateType.none
      ) {
        if (isInternetReachable) {
          const socket = getSocket();
        }
        logger?.(`[network] changed from ${this.lastNetworkType} -> ${currentType}`);
      }
      this.lastNetworkType = currentType;
    });
  }

  public stopNetworkWatch() {
    this.unsubscribeNetInfo?.();
  }

  private async reconnectTransport(socket: Socket, transport: types.Transport) {}

  private async handleDisconnected() {
    if (this.retries >= (this.options.maxRetries ?? 3)) {
      this.options.logger?.(`[${this.options.kind}] max retries hit, recreating transport`);
      await this.options.onRecreate?.();
      return;
    }
    this.retries++;
    this.options.logger?.(`[${this.options.kind}] retry #${this.retries} (disconnected)`);
    await this.options?.onRestart?.();
  }

  private async handleFailed() {
    if (this.retries >= (this.options.maxRetries ?? 3)) {
      this.options.logger?.(`[${this.options.kind}] max retries hit, recreating transport`);
      await this.options?.onRecreate?.();
      return;
    }
    this.retries++;
    this.options.logger?.(`[${this.options.kind}] retry #${this.retries} (failed)`);
    await this.options?.onRestart?.();
  }

  cleanUp() {
    this.stopNetworkWatch();
  }
}

/*
calls: 
1) reconnection in poor networks,network changes,connection drops.
2) call message. which should allow joining,making the call.
3) admin privillages in calls.

*/
