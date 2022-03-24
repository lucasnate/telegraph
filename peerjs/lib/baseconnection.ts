import { EventEmitter } from "eventemitter3";
import { Peer } from "./peer";
import { ServerMessage } from "./servermessage";
import { ConnectionType } from "./enums";

export abstract class BaseConnection extends EventEmitter {
  protected _open = false;

  readonly metadata: any;
  // @ts-ignore
  connectionId: string; 

  // @ts-ignore
  peerConnection: RTCPeerConnection | null;

  abstract get type(): ConnectionType;

  get open() {
    return this._open;
  }

  constructor(
    readonly peer: string,
    public provider: Peer | null,
    readonly options: any
  ) {
    super();

    this.metadata = options.metadata;
  }

  abstract close(): void;

  abstract handleMessage(message: ServerMessage): void;
}
