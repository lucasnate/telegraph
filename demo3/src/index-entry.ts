import { createGame } from './Game';
import { Peer } from '../../peerjs/lib/peer';
import { DataConnection } from '../../peerjs/lib/dataconnection';
import { LogLevel } from "../../peerjs/lib/logger";
import {updateUrlForFriend, onCopy, onOpen, showCanvas} from './renderPage';

const peer = new Peer('dummyid', {debug: LogLevel.All});
let peerId = new URL(window.location.href).searchParams.get('peer');
let playerNum = 1;
let startTime = 0; // For state rank calculation, wlll be updated before createGame

function syncStateFromPage() {
	return { delay: 4, rollback: 4, rank: Math.floor(Date.now() / 1000.0) - startTime };
}

function syncStateToPage() {
	return;
}

peer.on('connection', function() { console.log("CONNECTED!"); });
if (peerId == null) {
	peer.on('open', (id) => {
		updateUrlForFriend(id);	
	});
	peer.on('connection', (conn) => { registerConnection(conn); });
} else {
	playerNum = 2;
	// peer.on('open', (ignored_id) => {
		if (peerId == null) throw new Error('somehow peerId became null');
	    document.getElementById('server_prompt')!.style.display = 'none';
		console.log("Connecting to " + peerId);
		let conn = peer.connect(peerId);
		console.log(conn);
		registerConnection(conn!);
	// });
}

function registerConnection(conn: DataConnection) {
	conn.on('open', () => {
		startTime = Math.floor(Date.now() / 1000.0);
		showCanvas();
		createGame(peer, conn.peer, playerNum, syncStateFromPage(), syncStateToPage);
	});
	conn.on('error', () => { console.log("ERROR2!"); });
	conn.on('close', () => { console.log("CLOSE2!"); });
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

onCopy(copyToClipboard);
onOpen(openInAnotherTab);


