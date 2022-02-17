import * as t from 'io-ts';
import Peer from 'peerjs';
import { TelegraphEvent } from './events';

export const savedChecksumC = t.type({
	frame: t.number,
	checksum: t.string
})


export type SavedChecksum = t.TypeOf<typeof savedChecksumC>;

export interface TelegraphCallbacks<T> {
  onSaveState: () => T;
  onLoadState: (snapshot: T) => void;
  onAdvanceFrame: () => void;
  onEvent: (event: TelegraphEvent) => void;
  onChecksum: (snapshot: T) => string;
}

export interface TelegraphConfig<T> {
  // TODO: allow backend-specific configuration
  // backend: BackendKey;
  peer: Peer;
  callbacks: TelegraphCallbacks<T>;
  numPlayers: number;
  disconnectTimeout: number; // default = 5000
  disconnectNotifyStart: number; // default = 750
  syncData: any;
}

export type InputValues = number[];

export const connectionStatusC = t.type({
  disconnected: t.boolean,
  lastFrame: t.number,
});

export type ConnectionStatus = t.TypeOf<typeof connectionStatusC>;

export type DisconnectStatuses = boolean[];

export enum PlayerType {
  local,
  remote,
  spectator,
}

export type PlayerHandle = number;

export interface Player {
  type: PlayerType;
  playerNumber: number; // between 1 and maxPlayers
  // TODO: don't tie this to peerjs backend?
  remote?: RemoteDetails;
}

export interface RemoteDetails {
  peerId: string;
}

export interface TelegraphNetworkStats {
  ping: number;
  sendQueueLength: number;
  localFrameAdvantage: number;
  remoteFrameAdvantage: number;
  remainingDataSyncSteps: number;	
  remainingTimeSyncSteps: number;	
}

export interface SyncData {
	rank: number;
	delay: number;
	rollback: number;
}

export enum SynchronizationPhase {
	data,
	time,
	done,
}
