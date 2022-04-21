import { PeerJSSocket } from './PeerJSSocket';
import { ConnectionStatus, InputValues, TelegraphNetworkStats, SavedChecksum } from '../types';
import { ValueResult, ResultOk, ResultNotSynchronized } from '../resultTypes';
import { GameInput } from '../InputQueue';
import {
  TelegraphMessage,
  MessageInput,
  MessageInputAck,
  MessageQualityReport,
  MessageDataSyncRequest, 
  MessageDataSyncReply, 
  MessageSyncRequest,
  MessageSyncReply,
  MessageQualityReply,
  MessageSavedChecksums
} from './messages';
import { RingBuffer } from '../util/RingBuffer';
import { assert } from '../util/assert';
import {
  NetworkEvent,
  NetworkEventInterrupted,
  NetworkEventDisconnected,
  NetworkEventResumed,
} from './networkEvents';
import { ChecksumVerifier } from './ChecksumVerifier';
import { log } from '../log';
import { TimeSync } from '../TimeSync';

const NUM_TIME_SYNC_PACKETS = 5;
const DATA_SYNC_RETRY_INTERVAL = 2000;
const TIME_SYNC_RETRY_INTERVAL = 2000;
const TIME_SYNC_FIRST_RETRY_INTERVAL = 2000;
const RUNNING_RETRY_INTERVAL = 200;
const KEEP_ALIVE_INTERVAL = 200;
const QUALITY_REPORT_INTERVAL = 1000;
const NETWORK_STATS_INTERVAL = 1000;
const SHUTDOWN_TIMER = 5000;
const DATA_SYNC_PART_SIZE = 200; // TODO: Put 20 here instead of 200 to ensure this shit really works

interface PeerJSEndpointOptions {
  socket: PeerJSSocket;
  peerId: string;
  localConnectionStatus: ConnectionStatus[];
  disconnectTimeout: number;
  disconnectNotifyStart: number;
  localSyncData: any;
}

enum State {
  synchronizingData,
  synchronizingTime,	
  synchronized, // not used?
  running,
  disconnected,
}

interface HandlerResultAccepted { kind: "HandlerResultAccepted"; }
interface HandlerResultRejected { kind: "HandlerResultRejected"; }
interface HandlerResultReset { kind: "HandlerResultReset"; resetMsg: TelegraphMessage; }

export type HandlerResult = HandlerResultAccepted | HandlerResultRejected | HandlerResultReset;

export class PeerJSEndpoint {
  private socket: PeerJSSocket;
  private peerId: string;
  private disconnectTimeout: number;
  private disconnectNotifyStart: number;
  private localSyncData: any;
	
  /** shared state with other endpoints, sync, backend */
  private localConnectionStatus: ConnectionStatus[];

  /** local state for this endpoint */
  private peerConnectStatus: ConnectionStatus[] = [];

  // stats (TODO)
  private roundTripTime = 0;

  private lastSentInput: GameInput | null = null;
  private lastSendTime = 0;
  private lastRecvInput: GameInput | null = null;
  private lastRecvTime = 0;
  private lastAckedInput: GameInput | null = null;

  private connectedEventSent = false;
  private disconnectEventSent = false;
  private disconnectNotifySent = false;

  /** The time at which the connection should shut down after requesting a disconnect */
  private shutdownTime = 0;

  private nextSendSeq = 0;
  private lastRecvSeq = 0;

  // timesync stuff
  private localFrameAdvantage = 0;
  private remoteFrameAdvantage = 0;
  // private timesync = TimeSync;

  private currentState: State = State.synchronizingData;
	// TODO: We should give stateDetail an exact type instead of dynamic type it.
	private stateDetail: any;

  // Rift synchronization
  private timesync = new TimeSync();	
	
  // ring buffer probably overkill for this lol
  private eventQueue = new RingBuffer<NetworkEvent>(256);

  /**
   * This stores all the inputs we have not sent to this user yet.
   *
   * If it overflows the ring buffer, it'll crash the app. Theoretically I think
   * it should never go over the maxPredictionFrames?
   */
  private pendingOutput = new RingBuffer<GameInput>(256);

  private checksumVerifier = new ChecksumVerifier();

  restart() {
	  let oldReceivedDataSyncFirstPartSeq = this.stateDetail == null ? -1 : this.stateDetail.dataSync.receivedFirstPartSeq;
	  this.peerConnectStatus = [];
      this.roundTripTime = 0;
	  this.lastSentInput = null;
	  this.lastSendTime = 0;
	  this.lastRecvInput = null;
	  this.lastRecvTime = 0;
	  this.lastAckedInput = null;
	  this.connectedEventSent = false;
	  this.disconnectEventSent = false;
	  this.disconnectNotifySent = false;
	  this.localFrameAdvantage = 0;
	  this.remoteFrameAdvantage = 0;
	  this.currentState = State.synchronizingData;
	  this.stateDetail = {
		  // TODO: We should give this an exact type instead of dynamic type it.
		  dataSync: {
			  receivedParts: [] as string[],
			  receivedFirstPartSeq: oldReceivedDataSyncFirstPartSeq,
			  receivedPartsComplete: null as any,
			  receivedPartsCompleteFirstPartSeq: -1,
			  sentParts: [] as boolean[],
			  sentFirstPartSeq: -1,
		  },
		  sync: {
			  /**
			   * The randomly-generated string we send in a sync request and receive in
			   * a sync reply
			   */
			  random: 0,
			  roundtripsRemaining: 0,
		  },
		  running: {
			  lastQualityReportTime: 0,
			  lastNetworkStatsUpdateTime: 0,
			  lastInputPacketRecvTime: 0,
		  },
	  };
	  this.timesync = new TimeSync();
	  this.eventQueue = new RingBuffer<NetworkEvent>(256);
	  this.pendingOutput = new RingBuffer<GameInput>(256);
	  this.checksumVerifier = new ChecksumVerifier();
	  
  }
	
  constructor(opts: PeerJSEndpointOptions) {
	this.restart();
    this.socket = opts.socket;
    this.peerId = opts.peerId;
    this.localConnectionStatus = opts.localConnectionStatus;
    this.disconnectTimeout = opts.disconnectTimeout;
    this.disconnectNotifyStart = opts.disconnectNotifyStart;
    this.localSyncData = opts.localSyncData;  
  }

  getPeerId(): string {
    return this.peerId;
  }

  isSynchronized(): boolean {
    return this.currentState === State.running;
  }

  isRunning(): boolean {
    return this.currentState === State.running;
  }

  getPeerConnectStatus(id: number): ConnectionStatus {
    if (!this.peerConnectStatus[id]) {
      this.peerConnectStatus[id] = {
        lastFrame: -1,
        disconnected: false,
      };
    }
    return this.peerConnectStatus[id];
  }

  sendInput(input: GameInput): void {
    if (!this.socket) {
      return;
    }

    if (this.currentState === State.running) {
	  this.timesync.advanceFrame(input.frame, this.localFrameAdvantage, this.remoteFrameAdvantage);
      this.pendingOutput.push(input);
    }
    this.sendPendingOutput();
  }

  private sendPendingOutput(): void {
    let startFrame = 0;
    const inputs: InputValues[] = [];

    if (this.pendingOutput.getSize() > 0) {
      const last = this.lastAckedInput;

      startFrame = this.pendingOutput.front().frame;
      assert(
        !last || last.frame + 1 === startFrame,
        'PeerJSEndpoint: Next frame to send is not one greater than last frame sent'
      );

      for (let i = 0; i < this.pendingOutput.getSize(); i += 1) {
        // xxx: if we ever do smarter input encoding, _this_ is the point at
        // which we'd probably collapse down the queue
        inputs.push(this.pendingOutput.item(i).inputs);
      }
    }

    const ackFrame = this.lastRecvInput?.frame ?? -1;

    const inputMessage: MessageInput = {
      type: 'input',
      sequenceNumber: this.getAndIncrementSendSeq(),
      input: {
        ackFrame,
        startFrame,
        disconnectRequested: this.currentState === State.disconnected,
        peerConnectStatus: this.localConnectionStatus,
        inputs,
      },
    };

    this.sendMessage(inputMessage);
  }

  // TODO: I think this can be deleted.
  sendInputAck(): void {
    const inputAckMessage: MessageInputAck = {
      type: 'inputAck',
      sequenceNumber: this.getAndIncrementSendSeq(),
      inputAck: {
        ackFrame: this.lastRecvInput?.frame ?? -1,
      },
    };

    this.sendMessage(inputAckMessage);
  }

  processEventsQueue(cb: (evt: NetworkEvent) => void): void {
    log('PROCESSING EVENTS QUEUE', this.eventQueue.getSize());
    while (this.eventQueue.getSize() !== 0) {
      const evt = this.eventQueue.front();
      this.eventQueue.pop();
      cb(evt);
    }
  }

  /**
   * This method:
   *  - sends various messages that need to be sent at certain intervals.
   *  - enqueues various events that get read by the P2PBackend in the run loop.
   *
   * In GGPO, this method is `OnLoopPoll`. I've renamed it here since we're not,
   * uh, polling.
   */
  onTick(): void {
    if (!this.socket) {
      return;
    }

    const now = performance.now();
    if (this.currentState === State.synchronizingData) {
      const nextInterval = DATA_SYNC_RETRY_INTERVAL;

      if (this.lastSendTime && now > this.lastSendTime + nextInterval) {
        log(`Failed to data sync within ${nextInterval}ms, trying again`);
		// TODO: Ideally we should not resend anything, just what was missed.
        this.sendDataSyncRequest();
      }      
    } else if (this.currentState === State.synchronizingTime) {
      const nextInterval =
        this.stateDetail.sync.roundtripsRemaining === NUM_TIME_SYNC_PACKETS
          ? TIME_SYNC_FIRST_RETRY_INTERVAL
          : TIME_SYNC_RETRY_INTERVAL;

      if (this.lastSendTime && now > this.lastSendTime + nextInterval) {
        log(`Failed to time sync within ${nextInterval}ms, trying again`);
        this.sendTimeSyncRequest();
      }
    } else if (this.currentState === State.disconnected) {
      if (this.shutdownTime < now) {
        console.warn(
          'Disconnected, but PeerJS connection shutdown not implemented yet!'
        );
        this.shutdownTime = 0;
        delete this.socket;
      }
    } else if (this.currentState === State.running) {
      const runningState = this.stateDetail.running;
      const now = performance.now();

      // If we haven't gotten a packet in a while (lastInputRecv), re-send the
      // input (sendPendingOutput)
      if (runningState.lastInputPacketRecvTime + RUNNING_RETRY_INTERVAL < now) {
        this.sendPendingOutput();
        runningState.lastInputPacketRecvTime = now;
      }

      // Send quality reports on interval
      if (runningState.lastQualityReportTime + QUALITY_REPORT_INTERVAL < now) {
        const msg: MessageQualityReport = {
          type: 'qualityReport',
          sequenceNumber: this.getAndIncrementSendSeq(),
          qualityReport: {
            frameAdvantage: this.localFrameAdvantage,
            ping: now,
          },
        };

        this.sendMessage(msg);
        this.stateDetail.running.lastQualityReportTime = now;
      }

      // Update network stats on interval
      if (
        runningState.lastNetworkStatsUpdateTime + NETWORK_STATS_INTERVAL <
        now
      ) {
        // TODO
        // this.updateNetworkStats();
      }

      // Send keepalive if it's been a while since we've sent anything
      if (this.lastSendTime && this.lastSendTime + KEEP_ALIVE_INTERVAL < now) {
        this.sendMessage({
          type: 'keepAlive',
          sequenceNumber: this.getAndIncrementSendSeq(),
        });
      }

      // Send a network interruption event if we don't get any packets in
      // disconnectNotifyStart ms
      if (
        this.disconnectTimeout > 0 &&
        this.disconnectNotifyStart > 0 &&
        !this.disconnectNotifySent &&
        this.lastRecvTime + this.disconnectNotifyStart < now
      ) {
        const evt: NetworkEventInterrupted = {
          type: 'interrupted',
          interrupted: {
            disconnectTimeout:
              this.disconnectTimeout - this.disconnectNotifyStart,
          },
        };
        this.queueEvent(evt);
        this.disconnectNotifySent = true;
      }

      // Disconnect if we don't get any packets for disconnectTiemout ms
      if (
        this.disconnectTimeout > 0 &&
        !this.disconnectEventSent &&
        this.lastRecvTime + this.disconnectTimeout < now
      ) {
        const evt: NetworkEventDisconnected = {
          type: 'disconnected',
        };
        this.queueEvent(evt);
        this.disconnectEventSent = true;
      }
    }
  }

	private sendDataSyncRequest() : void {
		console.log('DEBUG: sendDataSyncRequest()');
		let str = JSON.stringify(this.localSyncData);
		// TODO: We should probably find a smarter way to do this, instead of just dividing
		//       by string length.
		this.stateDetail.dataSync.sentFirstPartSeq = this.getAndIncrementSendSeq();
		this.stateDetail.dataSync.sentParts = new Array(Math.ceil(str.length / DATA_SYNC_PART_SIZE));
		this.stateDetail.dataSync.sentParts.fill(false);
		for (let i = 0; i < str.length; i += DATA_SYNC_PART_SIZE) {
			let seq = this.stateDetail.dataSync.sentFirstPartSeq;
			if (i !== 0) seq = this.getAndIncrementSendSeq();
			const msg: MessageDataSyncRequest = {
				type: 'dataSyncRequest',
				sequenceNumber: seq,
				dataSyncRequest: {
					firstPartSeq: this.stateDetail.dataSync.sentFirstPartSeq,
					partCount: this.stateDetail.dataSync.sentParts.length,
					currentPartIndex: i,
					currentPart: str.substring(i, Math.min(i + DATA_SYNC_PART_SIZE, str.length))
				},
			};
			console.log('DEBUG: Sending ' + JSON.stringify(msg));
			this.sendMessage(msg);
		}
	}
	
  private sendTimeSyncRequest(): void {
    const random = Math.floor(Math.random() * Math.floor(Math.floor(2 ** 31)));
    this.stateDetail.sync.random = random;

    const msg: MessageSyncRequest = {
      type: 'syncRequest',
      sequenceNumber: this.getAndIncrementSendSeq(),
      syncRequest: {
        randomRequest: random,
      },
    };

    this.sendMessage(msg);
  }

  private getAndIncrementSendSeq(): number {
    const seq = this.nextSendSeq;
    this.nextSendSeq += 1;
    return seq;
  }

  private sendMessage(message: TelegraphMessage): void {
    // TODO:
    // - should this be buffered in a queue?
    // - could add artificial out-of-order packets + send latency here for
    //   debugging
    this.lastSendTime = performance.now();
    this.socket.sendTo(this.peerId, message);
  }

  onMessage(msg: TelegraphMessage): TelegraphMessage | null {
    // might be nice to type this properly some day:
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const handlers: { [type: string]: (msg: any) => HandlerResult } = {
      dataSyncRequest: this.handleDataSyncRequest,
      dataSyncReply: this.handleDataSyncReply,
      syncRequest: this.handleSyncRequest,
      syncReply: this.handleSyncReply,
      qualityReport: this.handleQualityReport,
      qualityReply: this.handleQualityReply,
      input: this.handleInput,
      inputAck: this.handleInputAck,
      keepAlive: this.handleKeepAlive,
      savedChecksums: this.handleSavedChecksums
    };

    // TODO: drop wildly out of order packets here?

    const seq = msg.sequenceNumber;

	  if (this.lastRecvSeq > seq) {
		  // Drop out-of-order packets
		  return null;
	  }
	  this.lastRecvSeq = seq;

      if (seq <= this.stateDetail.dataSync.receivedFirstPartSeq) {
		  // ignore messages that are from before we did reset
		  return null;
	  }
		  
	  
    if (
      this.currentState === State.synchronizingData &&
      msg.type !== 'dataSyncRequest' &&
      msg.type !== 'dataSyncReply'
    ) {
      // ignore messages until we've synced
      return null;
    }

    if (
      this.currentState === State.synchronizingTime &&
      msg.type !== 'dataSyncRequest' &&
      msg.type !== 'dataSyncReply' &&
      msg.type !== 'syncRequest' &&
      msg.type !== 'syncReply'
    ) {
      // ignore messages until we've synced
      return null;
    }

    const handler = handlers[msg.type];
    assert(
      !!handler,
      `PeerJSEndpoint: Could not find handler for msg type ${msg.type}`
    );

    const handlerResult = handler(msg);

    if (handlerResult.kind === "HandlerResultAccepted") {
      this.lastRecvTime = performance.now();
      if (this.disconnectNotifySent && this.currentState === State.running) {
        const evt: NetworkEventResumed = {
          type: 'resumed',
        };
        this.queueEvent(evt);
        this.disconnectNotifySent = false;
      }
    }
    return handlerResult.kind === 'HandlerResultReset' ? handlerResult.resetMsg : null;
  }

  private queueEvent(evt: NetworkEvent): void {
    log('enqueueing network event', evt);
    this.eventQueue.push(evt);
  }

  synchronize(): void {
    this.currentState = State.synchronizingData;
    this.stateDetail.sync.roundtripsRemaining = NUM_TIME_SYNC_PACKETS;
    this.sendDataSyncRequest();
  }

  disconnect(): void {
    this.currentState = State.disconnected;
    this.shutdownTime = performance.now() + SHUTDOWN_TIMER;
  }

  setLocalFrameNumber(localFrame: number): void {
    /*
     * "Estimate which frame the other guy is one by looking at the
     * last frame they gave us plus some delta for the one-way packet
     * trip time."
     */
    const lastReceivedFrame = this.lastRecvInput?.frame ?? -1;
    const remoteFrame = lastReceivedFrame + (this.roundTripTime * 60) / 1000;

    /*
     * "Our frame advantage is how many frames *behind* the other guy
     * we are.  Counter-intuative, I know.  It's an advantage because
     * it means they'll have to predict more often and our moves will
     * pop more frequenetly."
     */
    this.localFrameAdvantage = remoteFrame - localFrame;
  }

	recommendFrameDelay(): number {
		return this.timesync.recommendFrameWaitDuration()
	}

	private tryToSwitchToTimeSync(): void {
		let dataSync = this.stateDetail.dataSync;
		
		// Did we receive everything from the other side?
		for (let i = 0; i < dataSync.receivedParts.length; ++i)
			if (dataSync.receivedParts[i] == null) {
				console.log('DEBUG: tryToSwitchToTimeSync() we did not receive everything');
				return;
			}

		// Did we send everything to the other side?
		for (let i = 0; i < dataSync.sentParts.length; ++i)
			if (!dataSync.sentParts[i]) {
				console.log('DEBUG: tryToSwitchToTimeSync() we did not send everything');
				return;
			}

		console.log('tryToSwitchToTimeSync() is switching');
		this.currentState = State.synchronizingTime;
		this.queueEvent({type: 'dataSynchronized'});
		this.sendTimeSyncRequest();
	}

	countMissingSyncDataParts(): number {
		let missingCount = 0;
		let dataSync = this.stateDetail.dataSync;
		if (dataSync.receivedParts.length === 0)
			return 0xFFFFFFFF;
		else {
			for (let i = 0, l = dataSync.receivedParts.length; i < l; ++i)
				if (dataSync.receivedParts[i] == null) ++missingCount;
		}
		return missingCount;
	}
	
	getSyncData(): ValueResult<any, ResultOk | ResultNotSynchronized> {
		let str = "";
		let dataSync = this.stateDetail.dataSync;
		if (dataSync.receivedPartsComplete != null && dataSync.receivedPartsCompleteFirstPartSeq === dataSync.receivedFirstPartSeq)
			return {value: dataSync.receivedPartsComplete, code: 'ok'};
		
		if (dataSync.receivedParts.length === 0)
			return {value: null, code: 'notSynchronized'};
		for (let i = 0; i < dataSync.receivedParts.length; ++i) {
			if (dataSync.receivedParts[i] == null)
				return {value: null, code: 'notSynchronized'};
			else
				str += dataSync.receivedParts[i];
		}
		// TODO: cache this instead of calculating this again and again.
		dataSync.receivedPartsComplete = JSON.parse(str);
		dataSync.receivedPartsCompleteFirstPartSeq = dataSync.receivedFirstPartSeq;
		return {value: dataSync.receivedPartsComplete, code: 'ok'};
	}
	
	private handleDataSyncRequest = (msg: MessageDataSyncRequest): HandlerResult => {
		console.log("DEBUG: handleDataSyncRequest");
		let dataSync = this.stateDetail.dataSync;

		if (dataSync.receivedFirstPartSeq > msg.dataSyncRequest.firstPartSeq) {
			console.log('DEBUG: Rejecting data sync request due to it being too old');
			return {kind: 'HandlerResultRejected'};
		}
		
		if (this.currentState !== State.synchronizingData) {
			console.log('DEBUG: Got resetting data sync request');
			return {kind: 'HandlerResultReset', resetMsg: msg};
		}

		if (dataSync.receivedFirstPartSeq < msg.dataSyncRequest.firstPartSeq) {
			dataSync.receivedFirstPartSeq = msg.dataSyncRequest.firstPartSeq;
			dataSync.receivedParts = [];
		}
		if (dataSync.receivedParts.length === 0) {
			dataSync.receivedParts.length = msg.dataSyncRequest.partCount;
		} else {
			assert(dataSync.receivedParts.length === msg.dataSyncRequest.partCount,
				   'part count incosistent');
		}
		dataSync.receivedParts[msg.dataSyncRequest.currentPartIndex] = msg.dataSyncRequest.currentPart;
		const reply: MessageDataSyncReply = {
			type: 'dataSyncReply',
			sequenceNumber: this.getAndIncrementSendSeq(),
			dataSyncReply: {
				ackPartIndex: msg.dataSyncRequest.currentPartIndex,
				firstPartSeq: dataSync.receivedFirstPartSeq
			}
		};
		this.sendMessage(reply);

		this.tryToSwitchToTimeSync();
		return {kind: 'HandlerResultAccepted'};
	}

	private handleDataSyncReply = (msg: MessageDataSyncReply): HandlerResult => {
		console.log("DEBUG: handleDataSyncReply");
		if (this.currentState !== State.synchronizingData)
			return {kind: 'HandlerResultAccepted'};

		if (msg.dataSyncReply.firstPartSeq !== this.stateDetail.dataSync.sentFirstPartSeq)
			return {kind: 'HandlerResultRejected'};

		console.log("DEBUG: handleDataSyncReply adds part " + msg.dataSyncReply.ackPartIndex);
		this.stateDetail.dataSync.sentParts[msg.dataSyncReply.ackPartIndex] = true;

		this.tryToSwitchToTimeSync();
		return {kind: 'HandlerResultAccepted'};
	}
	
  private handleSyncRequest = (msg: MessageSyncRequest): HandlerResult => {
    console.log('DEBUG: handleSyncRequest - will send syncReply');
    const reply: MessageSyncReply = {
      type: 'syncReply',
      sequenceNumber: this.getAndIncrementSendSeq(),
      syncReply: {
        randomReply: msg.syncRequest.randomRequest,
      },
    };
    this.sendMessage(reply);
    return {kind: 'HandlerResultAccepted'};
  };

  private handleSyncReply = (msg: MessageSyncReply): HandlerResult => {
    if (this.currentState !== State.synchronizingTime) {
      console.log('DEBUG: handleSyncReply - not in the right state');
      return {kind: 'HandlerResultAccepted'};
    }

    if (msg.syncReply.randomReply !== this.stateDetail.sync.random) {
      console.log('DEBUG: handleSyncReply - random mismatch');
      return {kind: 'HandlerResultRejected'};
    }

    if (!this.connectedEventSent) {
      this.queueEvent({ type: 'connected' });
      this.connectedEventSent = true;
    }

    this.stateDetail.sync.roundtripsRemaining -= 1;

    if (this.stateDetail.sync.roundtripsRemaining === 0) {
      this.queueEvent({ type: 'synchronized' });
      this.currentState = State.running;
      this.lastRecvInput = null;
      log('[Endpoint] Synchronized');
    } else {
      this.queueEvent({
        type: 'synchronizing',
        synchronizing: {
          count: NUM_TIME_SYNC_PACKETS - this.stateDetail.sync.roundtripsRemaining,
          total: NUM_TIME_SYNC_PACKETS,
        },
      });
      this.sendTimeSyncRequest();
    }
    return {kind: 'HandlerResultAccepted'};
  };

  private handleQualityReport = (msg: MessageQualityReport): HandlerResult => {
    this.sendMessage({
      type: 'qualityReply',
      sequenceNumber: this.getAndIncrementSendSeq(),
      qualityReply: {
        pong: msg.qualityReport.ping,
      },
    });

    this.remoteFrameAdvantage = msg.qualityReport.frameAdvantage;

    return {kind: 'HandlerResultAccepted'};
  };

  private handleQualityReply = (msg: MessageQualityReply): HandlerResult => {
    this.roundTripTime = performance.now() - msg.qualityReply.pong;
    return {kind: 'HandlerResultAccepted'};
  };

  private handleInput = (msg: MessageInput): HandlerResult => {
    if (msg.input.disconnectRequested) {
      if (
        this.currentState !== State.disconnected &&
        !this.disconnectEventSent
      ) {
        this.queueEvent({ type: 'disconnected' });
        this.disconnectEventSent = true;
      }
    } else {
      const remoteStatus = msg.input.peerConnectStatus;

      for (let i = 0; i < remoteStatus.length; i += 1) {
        // TODO: uhh doesn't this cause out-of-order packets to crash the game?
        const peerConnectStatus = this.getPeerConnectStatus(i);
        assert(
          remoteStatus[i].lastFrame >= peerConnectStatus.lastFrame,
          'PeerJSEndpoint: Tried to update local copy of peer connect status to an older frame'
        );

        peerConnectStatus.disconnected =
          peerConnectStatus.disconnected || remoteStatus[i].disconnected;
        peerConnectStatus.lastFrame = Math.max(
          peerConnectStatus.lastFrame,
          remoteStatus[i].lastFrame
        );
      }
    }

    const lastRecvFrame = this.lastRecvInput?.frame ?? -1;

    msg.input.inputs.forEach((inputValues: InputValues, idx: number): void => {
      const currentFrame = msg.input.startFrame + idx;

      // XXX: If this is the first input we receive, we just use its first frame
      // instead of expecting frame 0 to account for frame delay
      const lastRecvFrame =
        this.lastRecvInput?.frame ?? msg.input.startFrame - 1;

      const minimumFrame = lastRecvFrame + 1;
      assert(
        currentFrame <= minimumFrame,
        `PeerJSEndpoint: Tried to process frame ${currentFrame} more than one newer than last handled input ${minimumFrame}`
      );

      if (currentFrame !== minimumFrame) {
        return;
      }

      this.lastRecvInput = {
        frame: currentFrame,
        inputs: inputValues,
      };

      this.queueEvent({
        type: 'input',
        input: {
          input: this.lastRecvInput,
        },
      });

      this.stateDetail.running.lastInputPacketRecvTime = performance.now();
    });

    assert(
      (this.lastRecvInput?.frame ?? -1) >= lastRecvFrame,
      'PeerJSEndpoint: Input message processing went backwards somehow'
    );

    this.clearInputBuffer(msg.input.ackFrame);

    return {kind: 'HandlerResultAccepted'};
  };

  private handleInputAck = (msg: MessageInputAck): HandlerResult => {
    this.clearInputBuffer(msg.inputAck.ackFrame);
    return {kind: 'HandlerResultAccepted'};
  };

  private handleKeepAlive = (): HandlerResult => {
    return {kind: 'HandlerResultAccepted'};
  };

	private handleSavedChecksums = (msg: MessageSavedChecksums): HandlerResult => {
		if (!this.checksumVerifier.add(msg.savedChecksums)) {
			console.log("ERROR: DESYNC!!!");
			this.queueEvent({ type: 'disconnected' });
			this.disconnectEventSent = true;
		}
		return {kind: 'HandlerResultAccepted'};
	}

  private clearInputBuffer(ackFrame: number): void {
    // Remove acked inputs from queue
    while (
      this.pendingOutput.getSize() > 0 &&
      this.pendingOutput.front().frame < ackFrame
    ) {
      this.lastAckedInput = this.pendingOutput.front();
      this.pendingOutput.pop();
    }
  }

  getNetworkStats(): TelegraphNetworkStats {
    return {
      ping: this.roundTripTime,
      sendQueueLength: this.pendingOutput.getSize(),
      localFrameAdvantage: this.localFrameAdvantage,
      remoteFrameAdvantage: this.remoteFrameAdvantage,
      remainingDataSyncSteps: this.currentState === State.synchronizingData ? this.countMissingSyncDataParts() : 0,
      remainingTimeSyncSteps: this.currentState === State.synchronizingData ? NUM_TIME_SYNC_PACKETS
                              : this.currentState === State.synchronizingTime ? this.stateDetail.sync.roundtripsRemaining
			                  : 0
    };
  }

	sendChecksums(checksums: SavedChecksum[]): void {
		if (!this.checksumVerifier.add(checksums)) {
			console.log("ERROR: DESYNC!!!");
			this.queueEvent({ type: 'disconnected'})
			this.disconnectEventSent = true;
		}
		const savedChecksumsMessage: MessageSavedChecksums = {
			type: 'savedChecksums',
			sequenceNumber: this.getAndIncrementSendSeq(),
			savedChecksums: checksums
		};
		this.sendMessage(savedChecksumsMessage);
	}

	setLocalSyncData(localSyncData: any) {
		this.localSyncData = localSyncData;
	}

}

