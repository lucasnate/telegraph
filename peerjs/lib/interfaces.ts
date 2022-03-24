export interface AnswerOption {
    sdpTransform?: Function;
}

export interface PeerJSOption {
  key?: string;
  host?: string;
  port?: number;
  path?: string;
  secure?: boolean;
  config?: RTCConfiguration;
  debug?: number;
}

export interface PeerConnectOption {
  label?: string;
  metadata?: any;
  serialization?: string;
  reliable?: boolean;
}

export interface CallOption {
  metadata?: any;
  sdpTransform?: Function;
}

export interface DataConnection {
  send(data: any): void;
  close(): void;
  on(event: string, cb: () => void): void;
  on(event: "data", cb: (data: any) => void): void;
  on(event: "open", cb: () => void): void;
  on(event: "close", cb: () => void): void;
  on(event: "error", cb: (err: any) => void): void;
  off(event: string, fn: Function, once?: boolean): void;
  dataChannel: RTCDataChannel;
  label: string;
  metadata: any;
  open: boolean;
  peerConnection: RTCPeerConnection;
  peer: string;
  reliable: boolean;
  serialization: string;
  type: string;
  bufferSize: number;
  stringify: (data: any) => string;
  parse: (data: string) => any;
}

export interface MediaConnection {
  answer(stream?: MediaStream, options?: AnswerOption): void;
  close(): void;
  on(event: string, cb: () => void): void;
  on(event: "stream", cb: (stream: MediaStream) => void): void;
  on(event: "close", cb: () => void): void;
  on(event: "error", cb: (err: any) => void): void;
  off(event: string, fn: Function, once?: boolean): void;
  open: boolean;
  metadata: any;
  peerConnection: RTCPeerConnection;
  peer: string;
  type: string;
}

export interface UtilSupportsObj {
  browser: boolean,
  webRTC: boolean;
  audioVideo: boolean;
  data: boolean;
  binaryBlob: boolean;
  reliable: boolean;
}

export interface util {
  browser: string;
  supports: UtilSupportsObj;
}
