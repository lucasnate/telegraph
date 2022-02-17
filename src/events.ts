// Public events for Telegraph
//
// Internal events should be defined in their own files

import { PlayerHandle } from './types';

//
// Public events
//
export interface TelegraphEventConnected {
  type: 'connected';
  connected: {
    playerHandle: PlayerHandle;
  };
}

export interface TelegraphEventDisconnected {
  type: 'disconnected';
  disconnected: {
    playerHandle: PlayerHandle;
  };
}

export interface TelegraphEventDataSynchronized {
  type: 'dataSynchronized';
}

export interface TelegraphEventSynchronizing {
  type: 'synchronizing';
  synchronizing: {
    playerHandle: PlayerHandle;
    count: number;
    total: number;
  };
}

export interface TelegraphEventSynchronized {
  type: 'synchronized';
  synchronized: {
    playerHandle: PlayerHandle;
  };
}

export interface TelegraphEventRunning {
  type: 'running';
}

export interface TelegraphEventConnectionInterrupted {
  type: 'connectionInterrupted';
  connectionInterrupted: {
    playerHandle: PlayerHandle;
    disconnectTimeout: number;
  };
}

export interface TelegraphEventConnectionResumed {
  type: 'connectionResumed';
  connectionResumed: {
    playerHandle: PlayerHandle;
  };
}

export interface TelegraphEventTimesync {
	type: 'timesync';
	timesync: {
		framesAhead: number;
	};
}

export interface TelegraphEventRestart {
	type: 'restart';
}

export type TelegraphEvent =
  | TelegraphEventConnected
  | TelegraphEventDisconnected
  | TelegraphEventDataSynchronized
  | TelegraphEventSynchronizing
  | TelegraphEventSynchronized
  | TelegraphEventRunning
  | TelegraphEventConnectionInterrupted
  | TelegraphEventConnectionResumed
  | TelegraphEventTimesync
  | TelegraphEventRestart;
