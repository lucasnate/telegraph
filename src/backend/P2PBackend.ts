// TODO: Change syncData to have an interface of being an `any`

import { NetworkEventInput } from '../network/networkEvents';
import { Sync } from '../Sync';
import { PeerJSSocket } from '../network/PeerJSSocket';
import { PeerJSEndpoint } from '../network/PeerJSEndpoint';
import { assert } from '../util/assert';
import { TelegraphMessage } from '../network/messages';
import { log } from '../log';
import {
  Player,
  PlayerHandle,
  TelegraphNetworkStats,
  TelegraphConfig,
  ConnectionStatus,
  TelegraphCallbacks,
  PlayerType,
  InputValues,
  SyncData
} from '../types';
import {
  ValueResult,
  VoidResult,
  ResultOk,
  ResultInvalidPlayerHandle,
  ResultPlayerAlreadyDisconnected,
  ResultNotSynchronized,	
  SyncInputResult,
  AddPlayerResult,
  AddLocalInputResult,
} from '../resultTypes';
import {
  TelegraphEventDisconnected,
  TelegraphEventConnected,
  TelegraphEventDataSynchronized,
  TelegraphEventSynchronizing,
  TelegraphEventSynchronized,
  TelegraphEventConnectionInterrupted,
  TelegraphEventConnectionResumed,
  TelegraphEventRunning,
} from '../events';

const RECOMMENDATION_INTERVAL = 240;

const DEFAULT_ROLLBACK = 8;
const DEFAULT_DELAY = 0;
const DEFAULT_SYNC_DATA = {rank: 0, delay: DEFAULT_DELAY, rollback: DEFAULT_ROLLBACK};

export class P2PBackend<T> {
  /** Shared state between this and the sync and connection classes! */
  private localConnectionStatus: ConnectionStatus[] = []; // Gets real value later in `restart()`
  private sync: Sync<T>;

  private numPlayers: number;
  private callbacks: TelegraphCallbacks<T>;
  private socket: PeerJSSocket;
  private endpoints: PeerJSEndpoint[] = [];
  private disconnectTimeout: number;
  private disconnectNotifyStart: number;
  private localSyncData: SyncData;
  private winningSyncData: SyncData = DEFAULT_SYNC_DATA;
  private localPlayerQueues: number[] = []
	
  // TODO: It is possible that this belongs in Sync more than it does here. If
  //       we will have in the future some support for rewind-after-desync,
  //       it will have to move to Sync.	
  private initialState: T;
	
  /**
   * When true, rejects any input because we're waiting for sync to be reached.
   */
  private synchronizing = true;
  private nextRecommendedSleep = 0;

	restart() {
		this.callbacks.onLoadState(this.initialState);
		this.localConnectionStatus = new Array(this.numPlayers)
			.fill(null)
			.map(() => ({
				lastFrame: -1,
				disconnected: false,
			}));
		this.sync = new Sync(this.numPlayers, this.callbacks, this.localConnectionStatus);
		this.synchronizing = true;
		this.nextRecommendedSleep = 0;
		this.forEachEndpoint((endpoint, idx) => { if (!endpoint) return; endpoint.restart(); endpoint.synchronize(); });
		return this.sync; // Returns this so it can be "assigned in constructor" to make ts happy
	}
	
  constructor(config: TelegraphConfig<T>) {
    this.numPlayers = config.numPlayers;
    this.callbacks = config.callbacks;
    this.initialState = this.callbacks.onSaveState();
    this.disconnectTimeout = config.disconnectTimeout;
    this.disconnectNotifyStart = config.disconnectNotifyStart;
    this.localSyncData = config.syncData;  
    this.socket = new PeerJSSocket(config.peer, {
      onMessage: this.onMessage.bind(this),
    });
    this.sync = this.restart(); 
  }

  private getEndpoint(queueIdx: number): PeerJSEndpoint | null {
    return this.endpoints[queueIdx];
  }

  private forEachEndpoint(
    cb: (endpoint: PeerJSEndpoint, queueIdx: number) => void
  ): void {
    this.endpoints.forEach((endpoint, idx) => {
      if (!endpoint) {
        return;
      }
      cb(endpoint, idx);
    });
  }

  addPlayer(player: Player): AddPlayerResult {
	console.log("DEBUG: Inside addPlayer of " + player);
    const queueIdx = player.playerNumber - 1;

    if (player.playerNumber < 1 || player.playerNumber > this.numPlayers) {
      console.log("DEBUG: addPlayer - " + player.playerNumber + " is out of range!");
      return { value: null, code: 'playerOutOfRange' };
    }

    const handle = this.queueIdxToPlayerHandle(queueIdx);

    if (player.type === PlayerType.remote) {
      console.log("DEBUG: Will call addRemotePlayer!");
      this.addRemotePlayer(player.remote!.peerId, queueIdx);
    } else {
		this.localPlayerQueues.push(queueIdx);
	}

    return { value: handle, code: 'ok' };
  }

  private addRemotePlayer(peerId: string, queueIdx: number): void {
    this.synchronizing = true;
    this.endpoints[queueIdx] = new PeerJSEndpoint({
      socket: this.socket,
      peerId,
      localConnectionStatus: this.localConnectionStatus,
      disconnectTimeout: this.disconnectTimeout,
   	  disconnectNotifyStart: this.disconnectNotifyStart,
      localSyncData: this.localSyncData,
    });
    console.log("DEBUG: Did addRemotePlayer for entry " + queueIdx);
    this.localConnectionStatus[queueIdx] = {
      disconnected: false,
      lastFrame: -1,
    };
    this.endpoints[queueIdx].synchronize();
  }

  addLocalInput(
    handle: PlayerHandle,
    inputValues: InputValues
  ): AddLocalInputResult {
    log('adding local input');
    if (this.sync.getInRollback()) {
      return { code: 'inRollback' };
    }
    if (this.synchronizing) {
      return { code: 'notSynchronized' };
    }

    const result = this.playerHandleToQueueIdx(handle);
    if (result.code !== 'ok') {
      return { code: result.code };
    }
    const queueIdx = result.value!;

    const input = this.sync.addLocalInput(queueIdx, inputValues);
    if (!input) {
      return { code: 'predictionThreshold' };
    }

    // i do not know why we need this conditional wrapper and neither does ggpo:
    // https://github.com/pond3r/ggpo/blob/master/src/lib/ggpo/backends/p2p.cpp#L291
    if (input.frame !== -1) {
      // indicate we have a confirmed frame for this player
      this.localConnectionStatus[queueIdx].lastFrame = input.frame;
      this.forEachEndpoint((endpoint) => {
        endpoint.sendInput(input);
      });
    }

    return { code: 'ok' };
  }

  syncInput(): SyncInputResult {
    if (this.synchronizing) {
      return { value: null, code: 'notSynchronized' };
    }

    return { value: this.sync.getSynchronizedInputs(), code: 'ok' };
  }

  incrementFrame(): VoidResult<ResultOk> {
    this.sync.incrementFrame();
    return { code: 'ok' };
  }

  /**
   * this method is called after runloop ticks and incoming WebRTC messages
   *
   * this is called doPoll() in GGPO, and does UDP polling in addition to
   * processing events and messages. because that's handled async in the
   * browser, this method is responsible for actually processing the incoming
   * messages we enqueue asynchronously, as well as a bunch of other logic.
   *
   * ggpo indicates you're supposed to call this as many times as you can during
   * your runloop's idle phase, but in practice i think we can get away with
   * just calling it once since we can't tight-loop in JS or it'll kill the tab.
   */
  postProcessUpdate(): void {
    log('*** processing updates');
    if (this.sync.getInRollback()) {
      return;
    }

    this.forEachEndpoint((endpoint) => {
      endpoint.onTick();
    });
    this.processEndpointEventsQueue();

    if (this.synchronizing) {
      return;
    }

    this.sync.checkSimulation();

    // notify all of our endpoints of their local frame number for their
    // next connection quality report
    const currentFrame = this.sync.getFrameCount();
    this.forEachEndpoint((endpoint) => {
      endpoint.setLocalFrameNumber(currentFrame);
    });

    const totalMinConfirmed =
      this.numPlayers <= 2 ? this.poll2Players() : this.pollNPlayers();

    if (totalMinConfirmed >= 0) {
      assert(
        totalMinConfirmed != Number.MAX_SAFE_INTEGER,
        'P2PBackend: could not find last confirmed frame'
      );

      log(`Setting last confirmed frame to ${totalMinConfirmed}`);
      let newSavedChecksums = this.sync.saveChecksumSavedFrames(totalMinConfirmed);
      if (newSavedChecksums.length > 0)
          this.forEachEndpoint((endpoint) => {
			  endpoint.sendChecksums(newSavedChecksums);
		  });
      this.sync.setLastConfirmedFrame(totalMinConfirmed);
    }

    if (currentFrame > this.nextRecommendedSleep) {
       let interval = 0;
       for (let i = 0; i < this.numPlayers; i += 1) {
         if (this.endpoints[i] != null) 
           interval = Math.max(interval, this.endpoints[i].recommendFrameDelay());
       }
       if (interval > 0) {
         this.callbacks.onEvent({
			 type: 'timesync',
			 timesync: { framesAhead: interval }
         });
         this.nextRecommendedSleep = currentFrame + RECOMMENDATION_INTERVAL;
       }
    }
  }

  /**
   * this is a weird function that i should refactor.
   *
   * it:
   * - determines the minimum confirmed frame between connected players
   *
   * it's simplified compared to pollNPlayers because if there's only two
   * players, there's only one endpoint to worry about
   */
  private poll2Players(): number {
    let totalMinConfirmed = Number.MAX_SAFE_INTEGER;

    for (let queueIdx = 0; queueIdx < this.numPlayers; queueIdx += 1) {
      const endpoint = this.getEndpoint(queueIdx);

      let queueConnected = true;
      if (endpoint && endpoint.isRunning()) {
        const status = endpoint.getPeerConnectStatus(queueIdx);
        queueConnected = !status.disconnected;
      }

      if (!this.localConnectionStatus[queueIdx].disconnected) {
        totalMinConfirmed = Math.min(
          this.localConnectionStatus[queueIdx].lastFrame,
          totalMinConfirmed
        );
      }

      if (!queueConnected && !this.localConnectionStatus[queueIdx]) {
        this.disconnectPlayerQueue(queueIdx, totalMinConfirmed);
      }
    }

    return totalMinConfirmed;
  }

  private pollNPlayers(): number {
    // TODO
    throw new Error('Not implemented yet');
  }

  /**
   * see: PollUdpProtocolEvents
   *
   * This queue is used for now because I'm not really sure of the ramifications
   * of instantly-processing events when queued.
   *
   * I think in the future we could just replace it with an immediate
   * `onEvent()` callback?
   */
  private processEndpointEventsQueue(): void {
    this.forEachEndpoint((endpoint, queueIdx) => {
      const handle = this.queueIdxToPlayerHandle(queueIdx);

      endpoint.processEventsQueue((evt) => {
        log('*** processing event', evt);
        if (evt.type === 'input') {
          // if queue not disconnected, add a remote input and update frame
          this.handleRemoteInput(queueIdx, evt);
        } else if (evt.type === 'disconnected') {
          this.disconnectPlayer(handle);
        } else if (evt.type === 'connected') {
          const outgoing: TelegraphEventConnected = {
            type: 'connected',
            connected: {
              playerHandle: handle,
            },
          };
          this.callbacks.onEvent(outgoing);
        } else if (evt.type === 'dataSynchronized') {
			const isSyncData = (syncData: any): syncData is SyncData => {
				return typeof(syncData.rank) == 'number' && Number.isSafeInteger(syncData.rank) &&
					typeof(syncData.delay) == 'number' && Number.isSafeInteger(syncData.delay) &&
					typeof(syncData.rollback) == 'number' && Number.isSafeInteger(syncData.rollback);
			}; 
			let strongestNetParamsRank = isSyncData(this.localSyncData) ? this.localSyncData.rank : 0;
			let strongestNetParamsPeerId = this.socket.getPeerId();
			this.winningSyncData = isSyncData(this.localSyncData) ? this.localSyncData : DEFAULT_SYNC_DATA;
			console.log(this.localSyncData);
			console.log("Local rank is " + strongestNetParamsRank + ", local guid is " + strongestNetParamsPeerId + " delay is " + this.winningSyncData.delay + " rollback is " + this.winningSyncData.rollback);
			this.forEachEndpoint((endpoint2, ignored) => {
				const maybeRemoteSyncData = endpoint2.getSyncData();
				if (maybeRemoteSyncData.code !== 'ok')
					return;
				const remoteSyncData = maybeRemoteSyncData.value;
				console.log(remoteSyncData);
				if (isSyncData(remoteSyncData) && (remoteSyncData.rank > strongestNetParamsRank || remoteSyncData.rank == strongestNetParamsRank && endpoint2.getPeerId() > strongestNetParamsPeerId)) {
					strongestNetParamsRank = remoteSyncData.rank;
					strongestNetParamsPeerId = endpoint2.getPeerId();
					console.log("Assigning " + JSON.stringify(remoteSyncData) + " into " + JSON.stringify(this.winningSyncData));
					this.winningSyncData = remoteSyncData;
				}
			});
			console.log("Winning rank is " + strongestNetParamsRank + ", winning guid is " + strongestNetParamsPeerId + " delay is " + this.winningSyncData.delay + " rollback is " + this.winningSyncData.rollback);
			for (const i of this.localPlayerQueues) {
				if (this.endpoints[i] == null)
					this.sync.setFrameDelay(i, this.winningSyncData.delay);
			}
			this.sync.setFrameRollback(this.winningSyncData.rollback);
			const outgoing: TelegraphEventDataSynchronized = { type: 'dataSynchronized' };
			this.callbacks.onEvent(outgoing);
		} else if (evt.type === 'synchronizing') {
          const outgoing: TelegraphEventSynchronizing = {
            type: 'synchronizing',
            synchronizing: {
              playerHandle: handle,
              count: evt.synchronizing.count,
              total: evt.synchronizing.total,
            },
          };
          this.callbacks.onEvent(outgoing);
        } else if (evt.type === 'synchronized') {
          const outgoing: TelegraphEventSynchronized = {
            type: 'synchronized',
            synchronized: {
              playerHandle: handle,
            },
          };
          this.callbacks.onEvent(outgoing);

          // since this player has synchronized, check to see if all players
          // have synchronized!
          this.checkInitialSync();
        } else if (evt.type === 'interrupted') {
          const outgoing: TelegraphEventConnectionInterrupted = {
            type: 'connectionInterrupted',
            connectionInterrupted: {
              playerHandle: handle,
              disconnectTimeout: evt.interrupted.disconnectTimeout,
            },
          };
          this.callbacks.onEvent(outgoing);
        } else if (evt.type === 'resumed') {
          const outgoing: TelegraphEventConnectionResumed = {
            type: 'connectionResumed',
            connectionResumed: {
              playerHandle: handle,
            },
          };
          this.callbacks.onEvent(outgoing);
        }
      });
    });
  }

  handleRemoteInput(queueIdx: number, evt: NetworkEventInput): void {
    const queueStatus = this.localConnectionStatus[queueIdx];
    if (queueStatus.disconnected) {
      return;
    }

    const currentRemoteFrame = queueStatus.lastFrame;
    const newRemoteFrame = evt.input.input.frame;
    assert(
      currentRemoteFrame === -1 || newRemoteFrame === currentRemoteFrame + 1,
      `P2PBackend: Got out of order remote frame (wanted ${
        currentRemoteFrame + 1
      }, got ${newRemoteFrame}`
    );

    this.sync.addRemoteInput(queueIdx, evt.input.input);
    this.localConnectionStatus[queueIdx].lastFrame = evt.input.input.frame;
  }

  /**
   * "Called only as the result of a local decision to disconnect. The remote
   * decisions to disconnect are a result of us parsing the
   * peer_connect_status blob in every endpoint periodically."
   *
   * ok, so what's weird about what i just quoted from the ggpo codebase is that
   * I don't think this is actually true: we also call it when a remote player
   * disconnects via the `disconnect_requested` field on an input message. maybe
   * I am misunderstanding what this means (it did spawn from _a_ local
   * decision, just not _our_ local decision), and it is true that other
   * decisions (though I'm not sure where those "decisions" come from)
   */
  disconnectPlayer(
    handle: PlayerHandle
  ): VoidResult<
    ResultOk | ResultInvalidPlayerHandle | ResultPlayerAlreadyDisconnected
  > {
    const result = this.playerHandleToQueueIdx(handle);
    if (result.code !== 'ok') {
      return result;
    }
    const queueIdx = result.value!;

    if (this.localConnectionStatus[queueIdx].disconnected) {
      return { code: 'playerAlreadyDisconnected' };
    }

    const endpoint = this.getEndpoint(queueIdx);
    if (!endpoint) {
      // local player is disconnecting, so mark all other endpoints as
      // disconnected
      const currentFrame = this.sync.getFrameCount();
      this.forEachEndpoint((endpoint, queueIdx) => {
        this.disconnectPlayerQueue(queueIdx, currentFrame);
      });
    } else {
      this.disconnectPlayerQueue(
        queueIdx,
        this.localConnectionStatus[queueIdx].lastFrame
      );
    }

    return { code: 'ok' };
  }

  disconnectPlayerQueue(queueIdx: number, syncTo: number): void {
    const frameCount = this.sync.getFrameCount();
    const endpoint = this.getEndpoint(queueIdx);

    // kinda think we shouldn't need this
    assert(
      endpoint !== null,
      `P2PBackend: Tried to disconnect nonexistent player queue ${queueIdx}`
    );

    endpoint!.disconnect();
    this.localConnectionStatus[queueIdx].disconnected = true;
    this.localConnectionStatus[queueIdx].lastFrame = syncTo;

    // roll back to where player disconnected
    if (syncTo < frameCount) {
      this.sync.adjustSimulation(syncTo);
    }

    const event: TelegraphEventDisconnected = {
      type: 'disconnected',
      disconnected: {
        playerHandle: this.queueIdxToPlayerHandle(queueIdx),
      },
    };
    this.callbacks.onEvent(event);

    // in case a player disconnects during the initial synchronization
    this.checkInitialSync();
  }

	getSyncData(handle: PlayerHandle): ValueResult<any, ResultOk | ResultInvalidPlayerHandle | ResultNotSynchronized> {
		const result = this.playerHandleToQueueIdx(handle);
		if (result.code !== 'ok') {
			return { code: result.code, value: null };
		}
		let endpoint = this.getEndpoint(result.value!);
		if (endpoint == null)
			return {code: 'ok', value: this.localSyncData};
		else
			return endpoint.getSyncData();
	}

	getWinningSyncData(): SyncData {
		return this.winningSyncData;
	}
	
	setLocalSyncData(localSyncData: SyncData) {
		console.log("setLocalSyncData(" + JSON.stringify(localSyncData) + ")");
		this.localSyncData = localSyncData;
		this.forEachEndpoint((endpoint, idx) => { endpoint.setLocalSyncData(localSyncData); });
	}
	
  getNetworkStats(
    handle: PlayerHandle
  ): ValueResult<TelegraphNetworkStats, ResultOk | ResultInvalidPlayerHandle> {
    const result = this.playerHandleToQueueIdx(handle);
    if (result.code !== 'ok') {
      return { code: result.code, value: null };
    }
    const stats = this.getEndpoint(result.value!)?.getNetworkStats() ?? {
      // placeholder in case you get local player for some reason
      ping: -1,
	  sendQueueLength: -1,
      localFrameAdvantage: -1,
      remoteFrameAdvantage: -1,
      remainingDataSyncSteps: 0,
      remainingTimeSyncSteps: 0
    };
    return { code: 'ok', value: stats };
  }

  private onMessage(fromId: string, message: TelegraphMessage): void {
    const endpoint = this.endpoints.find(
      (endpoint) => endpoint?.getPeerId() === fromId
    );
    if (!endpoint) {
      throw new Error(`no endpoint found for peer ID ${fromId}`);
    }
    let postRestartMsg = endpoint.onMessage(message);
    let needRestart = postRestartMsg != null;
    if (needRestart) {
	  this.restart();
      this.callbacks.onEvent({type: 'restart'});
      endpoint.onMessage(message);
	}
    else
      this.postProcessUpdate();
  }

  private queueIdxToPlayerHandle(queue: number): number {
    return queue + 1;
  }

  private playerHandleToQueueIdx(
    handle: PlayerHandle
  ): ValueResult<number, ResultOk | ResultInvalidPlayerHandle> {
    const offset = handle - 1;
    if (offset < 0 || offset >= this.numPlayers) {
      return { value: null, code: 'invalidPlayerHandle' };
    }
    return { value: offset, code: 'ok' };
  }

  private checkInitialSync(): void {
    if (!this.synchronizing) {
      return;
    }

    this.forEachEndpoint((endpoint, queueIdx) => {
      if (
        !endpoint.isSynchronized() &&
        !this.localConnectionStatus[queueIdx].disconnected
      ) {
        log(`[Backend] Waiting for ${queueIdx} to sync`);
        // still awaiting a sync
        return;
      }

      const event: TelegraphEventRunning = {
        type: 'running',
      };
      this.callbacks.onEvent(event);
      this.synchronizing = false;
      log('[Backend] Synchronized all peers');
    });
  }

  setFrameDelay(
    handle: PlayerHandle,
    delay: number
  ): VoidResult<ResultOk | ResultInvalidPlayerHandle> {
    const result = this.playerHandleToQueueIdx(handle);
    if (result.code !== 'ok') {
      return { code: result.code };
    }

    this.sync.setFrameDelay(result.value!, delay);

    return { code: 'ok' };
  }

	getFrameDelay(handle: PlayerHandle): ValueResult<number, ResultOk | ResultInvalidPlayerHandle> {
		const result = this.playerHandleToQueueIdx(handle);
		if (result.code !== 'ok') {
			return { code: result.code, value: null };
		}
		
		return { code: 'ok', value: this.sync.getFrameDelay(result.value!) };
	}

	getFrameRollback(): number {
		return this.sync.getFrameRollback();
	}

}
