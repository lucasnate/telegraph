import { Player, PlayerHandle, SyncData, TelegraphNetworkStats } from '../types';
import {
  ValueResult,
  VoidResult,
  ResultOk,
  ResultInvalidPlayerHandle,
  ResultPlayerAlreadyDisconnected,
  ResultNotSynchronized,	
  AddLocalInputResult,
  AddPlayerResult,
  SyncInputResult,
} from '../resultTypes';

export abstract class Backend {
  abstract addPlayer(player: Player): AddPlayerResult;

  abstract addLocalInput(
    handle: PlayerHandle,
    input: number[]
  ): AddLocalInputResult;

  abstract syncInput(): SyncInputResult;

  abstract incrementFrame(): VoidResult<ResultOk>;
  abstract disconnectPlayer(
    handle: PlayerHandle
  ): VoidResult<
    ResultOk | ResultInvalidPlayerHandle | ResultPlayerAlreadyDisconnected
  >;
  abstract getNetworkStats(
    handle: PlayerHandle
  ): ValueResult<TelegraphNetworkStats, ResultOk | ResultInvalidPlayerHandle>;

	abstract getSyncData(handle: PlayerHandle): ValueResult<SyncData, ResultOk | ResultInvalidPlayerHandle | ResultNotSynchronized>;

	abstract getWinningSyncData(): SyncData;
	
	abstract setLocalSyncData(localSyncData: any): void;
	
  // this isn't actually implemented in GGPO's backends but exists in the API
  // chat(text: string): ResultOk;

  abstract setFrameDelay(
    handle: PlayerHandle,
    delay: number
  ): VoidResult<ResultOk | ResultInvalidPlayerHandle>;

  abstract getFrameDelay(
    handle: PlayerHandle,
  ): ValueResult<number, ResultOk | ResultInvalidPlayerHandle>;

	abstract getFrameRollback(): number;

	
  abstract restart(): void;
	
  abstract postProcessUpdate(): void;
}
