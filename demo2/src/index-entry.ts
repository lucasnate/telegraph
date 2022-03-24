// TODO: When a disconnection occurs, report it.
// TODO: Allow single user mode and enable handicap only for it.


import { createGame, resetGame, GameSyncData } from './Game';
import Peer, { DataConnection } from 'peerjs';
import { setMinFakeLag, setMaxFakeLag, setFakePacketLoss } from '../../src/network/PeerJSSocket';
import { updateUrlForFriend, onMinFakeLagInput, onMaxFakeLagInput, onFakePacketLossInput, onDelayInput, onRollbackInput, onReset, onCopy, onOpen, onKeyIntervalInput, onDistanceInput, onMoveTypeChange, updateRange, showOnlineStuff } from './renderPage';

const peer = new Peer({
     secure:true,
     host: 'makot-bakhalal.herokuapp.com',
     port: 443
});
let peerId = new URL(window.location.href).searchParams.get('peer');
let playerNum = 1;

let startTime = 0; // For state rank calculation, wlll be updated before createGame

function registerConnection(conn: DataConnection) {
	conn.on('open', () => {
		startTime = Math.floor(Date.now() / 1000.0);
		showOnlineStuff();
		createGame(peer, conn.peer, playerNum, syncStateFromPage(), syncStateToPage);
	});
	conn.on('error', () => { console.log("ERROR2!"); });
	conn.on('close', () => { console.log("CLOSE2!"); });
}

peer.on('connection', function() { console.log("CONNECTED!"); });
if (peerId == null) {
	peer.on('open', (id) => {
		updateUrlForFriend(id);	
	});
	peer.on('connection', (conn) => { registerConnection(conn); });
} else {
	playerNum = 2;
	peer.on('open', (ignored_id) => {
		if (peerId == null) throw new Error('somehow peerId became null');
		document.getElementById('server_prompt')!.remove();
		console.log("Connecting to " + peerId);
		let conn = peer.connect(peerId);
		console.log(conn);
		registerConnection(conn);
	});
}

let delayedResetTimer: number | null = null;
function resetGameSoon() {
	if (delayedResetTimer != null) {
		window.clearTimeout(delayedResetTimer);
		delayedResetTimer = null;
	}
	delayedResetTimer = window.setTimeout(resetWithParams, 1000);
}

function syncStateFromPage() {
	const delay = parseInt((document.getElementById('delay') as HTMLInputElement).value);
	const rollback = parseInt((document.getElementById('rollback') as HTMLInputElement).value);
	const keyInterval = parseInt((document.getElementById('key_interval') as HTMLInputElement).value);
	const distance = parseInt((document.getElementById('distance') as HTMLInputElement).value);
	const moveType = (document.getElementById('move_type') as HTMLSelectElement).value;
	return {delay: delay, rollback: rollback, keyInterval: keyInterval,
			distance: distance, moveType: moveType,
			rank: Math.floor(Date.now() / 1000.0) - startTime};
}

function syncStateToPage(winningSyncData: GameSyncData) {
	updateRange(document.getElementById('delay') as HTMLInputElement, winningSyncData.delay);
	updateRange(document.getElementById('rollback') as HTMLInputElement, winningSyncData.rollback);
	updateRange(document.getElementById('key_interval') as HTMLInputElement, winningSyncData.keyInterval);
	updateRange(document.getElementById('distance') as HTMLInputElement, winningSyncData.distance);
	(document.getElementById('move_type') as HTMLInputElement).value = winningSyncData.moveType;
}

function resetWithParams() {
	resetGame(syncStateFromPage());
}

function copyToClipboard() {
	let success = false;
	if (navigator.clipboard) {
		try {
			navigator.clipboard.writeText(document.getElementById('url_for_friend')!.innerText);
			success = true;
		} finally {

		}
	}
	let copy = document.getElementById('copy')!;
	let origText = copy.innerText;
	copy.innerText = success ? 'copied' : 'failed';
	setInterval(() => { copy.innerText = origText; }, 1000);
}

function openInAnotherTab() {
	window.open(document.getElementById('url_for_friend')!.innerText, "_blank");
}

onMinFakeLagInput(setMinFakeLag);
onMaxFakeLagInput(setMaxFakeLag);
onFakePacketLossInput(setFakePacketLoss);
onDelayInput(resetGameSoon);
onRollbackInput(resetGameSoon);
onKeyIntervalInput(resetGameSoon);
onDistanceInput(resetGameSoon);
onMoveTypeChange(resetGameSoon);
onReset(resetWithParams);
onCopy(copyToClipboard);
onOpen(openInAnotherTab);
