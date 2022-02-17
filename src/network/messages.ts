import * as t from 'io-ts';
import { PathReporter } from 'io-ts/lib/PathReporter';
import { isLeft } from 'fp-ts/lib/Either';
import { connectionStatusC, savedChecksumC } from '../types';

// TODO: we may want to use the "magic number" field from GGPO, which I think
// is basically just extremely naive authentication by designating a magic
// number that must always be in a socket for a given connection? but that
// might be overkill for webrtc
const baseMessage = {
  sequenceNumber: t.number,
};

const dataSyncRequestMessage = t.type({
	...baseMessage,
	type: t.literal('dataSyncRequest'),
	dataSyncRequest: t.type({
		firstPartSeq: t.number,
		partCount: t.number,
		currentPartIndex: t.number,
		currentPart: t.string,
	}),
});

export type MessageDataSyncRequest = t.TypeOf<typeof dataSyncRequestMessage>;

const dataSyncReplyMessage = t.type({
	...baseMessage,
	type: t.literal('dataSyncReply'),
	dataSyncReply: t.type({ ackPartIndex: t.number, firstPartSeq: t.number })
});

export type MessageDataSyncReply = t.TypeOf<typeof dataSyncReplyMessage>;

const syncRequestMessage = t.type({
  ...baseMessage,
  type: t.literal('syncRequest'),
  syncRequest: t.type({
    // included in the reply to match request-response
    randomRequest: t.number,
  }),
});

export type MessageSyncRequest = t.TypeOf<typeof syncRequestMessage>;

const syncReplyMessage = t.type({
  ...baseMessage,
  type: t.literal('syncReply'),
  syncReply: t.type({
    // included in the reply to match request-response
    randomReply: t.number,
  }),
});

export type MessageSyncReply = t.TypeOf<typeof syncReplyMessage>;

const qualityReportMessage = t.type({
  ...baseMessage,
  type: t.literal('qualityReport'),
  qualityReport: t.type({
    frameAdvantage: t.number,
    // The current time in MS. The reply will send back and it will be compared
    // to current time to get the actual ping
    ping: t.number,
  }),
});

export type MessageQualityReport = t.TypeOf<typeof qualityReportMessage>;

const qualityReplyMessage = t.type({
  ...baseMessage,
  type: t.literal('qualityReply'),
  qualityReply: t.type({
    pong: t.number,
  }),
});

export type MessageQualityReply = t.TypeOf<typeof qualityReplyMessage>;

const inputMessage = t.type({
  ...baseMessage,
  type: t.literal('input'),
  input: t.type({
    ackFrame: t.number,
    peerConnectStatus: t.array(connectionStatusC),
    disconnectRequested: t.boolean,
    startFrame: t.number,
    inputs: t.array(t.array(t.number)),
  }),
});

export type MessageInput = t.TypeOf<typeof inputMessage>;

const inputAckMessage = t.type({
  ...baseMessage,
  type: t.literal('inputAck'),
  inputAck: t.type({
    ackFrame: t.number,
  }),
});

export type MessageInputAck = t.TypeOf<typeof inputAckMessage>;

const keepAliveMessage = t.type({
  ...baseMessage,
  type: t.literal('keepAlive'),
});

export type MessageKeepAlive = t.TypeOf<typeof keepAliveMessage>;


const savedChecksumsMessage = t.type({
	...baseMessage,
	type: t.literal('savedChecksums'),
	savedChecksums: t.array(savedChecksumC)
});

export type MessageSavedChecksums = t.TypeOf<typeof savedChecksumsMessage>;

const telegraphMessage = t.union([
  dataSyncRequestMessage,
  dataSyncReplyMessage,
  syncRequestMessage,
  syncReplyMessage,
  qualityReportMessage,
  qualityReplyMessage,
  inputMessage,
  inputAckMessage,
  keepAliveMessage,
  savedChecksumsMessage,
]);
export type TelegraphMessage = t.TypeOf<typeof telegraphMessage>;

export function parseTelegraphMessage(data: unknown): TelegraphMessage | null {
  const result = telegraphMessage.decode(data);

  if (isLeft(result)) {
    const errors = PathReporter.report(result);
    console.warn('parsing errors:', errors);
    return null;
  }

  return result.right;
}
