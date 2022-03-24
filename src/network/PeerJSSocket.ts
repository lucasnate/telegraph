import { Peer } from '../../peerjs/lib/peer';
import { DataConnection } from '../../peerjs/lib/dataconnection';
import { assert } from '../util/assert';
import { parseTelegraphMessage, TelegraphMessage } from './messages';
import { log } from '../log';

let minFakeLag: number = 0;
let maxFakeLag: number = 0;
let fakePacketLoss: number = 0;

export function setMinFakeLag(value: number) { minFakeLag = value; }
export function setMaxFakeLag(value: number) { maxFakeLag = value; }
export function setFakePacketLoss(value: number) { fakePacketLoss = value; }

interface SocketCallbacks {
  onMessage(fromId: string, msg: TelegraphMessage): void;
}

/**
 * This class handles storing all of the different data connections for
 * different peers. The logic of what we do with these connections lives in
 * PeerJSEndpoint.
 *
 * This class gets handed a Peer that should already be connected to all
 * players.
 */
export class PeerJSSocket {
  private peer: Peer;
  private connections: { [peerId: string]: DataConnection } = {};
  private callbacks: SocketCallbacks;

  constructor(peer: Peer, callbacks: SocketCallbacks) {
    this.callbacks = callbacks;
    this.peer = peer;

    for (const conn of Object.values(this.peer.connections)) {
      this.registerConnection((conn as DataConnection[])[0]);
    }

    this.peer.on('disconnected', () => {
      console.warn('Disconnected from signaling server');
    });

    this.peer.on('error', (error) => {
      console.error('peer error', error);
    });
  }

  registerConnection = (conn: DataConnection): void => {
    this.connections[conn.peer] = conn;

	assert(conn.serialization == 'json', "Must use JSON serialization");

    conn.on('close', () => {
      console.log(`closed connection with peer ${conn.peer}`);
    });

    conn.on('data', (data) => {
      const message = parseTelegraphMessage(data);
      if (!message) {
        console.warn('Received invalid message', data);
        return;
      }
      log('[messages] Received', message);
      this.callbacks.onMessage(conn.peer, message);
    });
  };

	getPeerId(): string {
		return this.peer.id!;
	}
	
  sendTo(peerId: string, message: TelegraphMessage): void {
    assert(
      !!this.connections[peerId],
      `Tried to send message to nonexistent connection ${peerId}`
    );
	log('[messages] Sending', message);
    if (minFakeLag === 0 && maxFakeLag === 0 && fakePacketLoss === 0)
	  this.connections[peerId].send(message);
	else {
	  let fakeLag = Math.floor(Math.random() * (maxFakeLag - minFakeLag + 1));
      if (Math.random() * 100 >= fakePacketLoss)	
	    setTimeout(() => { this.connections[peerId].send(message); }, fakeLag + minFakeLag); // DEBUG: This creates fake lag
	}
  }
}
