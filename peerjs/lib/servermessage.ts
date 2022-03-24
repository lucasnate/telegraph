import { ServerMessageType } from "./enums";

export class ServerMessage {
  // @ts-ignore  
  type: ServerMessageType;
  payload: any;
  // @ts-ignore  
  src: string;
}
