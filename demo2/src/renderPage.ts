let minFakeLagCallback: (value:number) => void = (ignored) => {}
let maxFakeLagCallback: (value:number) => void = (ignored) => {}
let fakePacketLossCallback: (value:number) => void = (ignored) => {}
let delayCallback: () => void = () => {}
let rollbackCallback: () => void = () => {}
let keyIntervalCallback: () => void = () => {}
let distanceCallback: () => void = () => {}
let moveTypeCallback: () => void = () => {}

export function updateUrlForFriend(peerId: string) : void {
	let url = new URL(window.location.href);
	url.searchParams.set('peer', peerId);
	document.getElementById('url_for_friend')!.innerText = url.href;
	document.getElementById('client_prompt')!.remove();
}

export function onMinFakeLagInput(cb: (value:number) => void): void {
	minFakeLagCallback = cb;
}

export function onMaxFakeLagInput(cb: (value:number) => void): void {
	maxFakeLagCallback = cb;
}

export function onFakePacketLossInput(cb: (value:number) => void): void {
	fakePacketLossCallback = cb;
}

export function onDelayInput(cb: () => void): void {
	delayCallback = cb;
}

export function onRollbackInput(cb: () => void): void {
	rollbackCallback = cb;
}

export function onKeyIntervalInput(cb: () => void): void {
	keyIntervalCallback = cb;
}

export function onDistanceInput(cb: () => void): void {
	distanceCallback = cb;
}

export function onMoveTypeChange(cb: () => void): void {
	moveTypeCallback = cb;
}

export function onReset(cb: () => void): void {
	document.getElementById('reset')!.onclick = cb;
}

export function onCopy(cb: () => void): void {
	document.getElementById('copy')!.onclick = cb;
}

export function onOpen(cb: () => void): void {
	document.getElementById('open')!.onclick = cb;
}

export function updateRange(range: HTMLInputElement, value: number) {
	range.value = value.toString();
	updateOutputOfRange(range);
}

export function showOnlineStuff() {
	document.getElementById('offline_stuff')!.style.display = 'none';
	document.getElementById('online_stuff')!.style.display = 'block';	
}

function updateOutputOfRange(range: HTMLInputElement) {
	(range.nextElementSibling! as HTMLOutputElement).value = range.value;
}

document.getElementById('min_fake_lag')!.oninput = () => {
	let range = (document.getElementById('min_fake_lag') as HTMLInputElement);
	if (range === null) throw new Error('missing min_fake_lag');
		
	updateOutputOfRange(range);
	let otherRange = (document.getElementById('max_fake_lag') as HTMLInputElement);
	if (parseInt(range.value) > parseInt(otherRange.value)) {
		otherRange.value = range.value;
		updateOutputOfRange(otherRange);
		maxFakeLagCallback(parseInt(range.value));
	}
	
	minFakeLagCallback(parseInt(range.value));
};

document.getElementById('max_fake_lag')!.oninput = () => {
	let range = (document.getElementById('max_fake_lag') as HTMLInputElement);
	if (range === null) throw new Error('missing max_fake_lag');

	updateOutputOfRange(range);
	let otherRange = (document.getElementById('min_fake_lag') as HTMLInputElement);
	if (parseInt(range.value) < parseInt(otherRange.value)) {
		otherRange.value = range.value;
		updateOutputOfRange(otherRange);
		minFakeLagCallback(parseInt(range.value));
	}

	maxFakeLagCallback(parseInt(range.value));
};

document.getElementById('fake_packet_loss')!.oninput = () => {
	let range = (document.getElementById('fake_packet_loss') as HTMLInputElement);
	if (range === null) throw new Error('missing fake_packet_loss');

	updateOutputOfRange(range);
	fakePacketLossCallback(parseInt(range.value));
};

document.getElementById('delay')!.oninput = () => {
	updateOutputOfRange(document.getElementById('delay') as HTMLInputElement);
	delayCallback();
}

document.getElementById('rollback')!.oninput = () => {
	updateOutputOfRange(document.getElementById('rollback') as HTMLInputElement);
	rollbackCallback();
}

document.getElementById('key_interval')!.oninput = () => {
	updateOutputOfRange(document.getElementById('key_interval') as HTMLInputElement);
	keyIntervalCallback();
}

document.getElementById('distance')!.oninput = () => {
	updateOutputOfRange(document.getElementById('distance') as HTMLInputElement);
	distanceCallback();
}

document.getElementById('move_type')!.onchange = () => {
	moveTypeCallback();
}

document.getElementById('show_help')!.onclick = () => { document.getElementById('help')!.style.display = 'block';
														document.getElementById('main')!.style.display = 'none'; };
document.getElementById('hide_help')!.onclick = () => { document.getElementById('main')!.style.display = 'block';
														document.getElementById('help')!.style.display = 'none'; };
document.getElementById('help')!.style.display = 'none';

document.getElementById('online_stuff')!.style.display = 'none';

let popupButtons = document.getElementsByClassName('popup_button');
for (let i = 0, l = popupButtons.length; i < l; ++i) {
	let button = popupButtons.item(i)! as HTMLButtonElement;
	button.onclick = () => {
		let span = button.nextElementSibling! as HTMLSpanElement;
		if (span.style.display === "inline") {
			button.innerText = '?';
			span.style.display = "none";
		} else {
			button.innerText = 'X';
			span.style.display = "inline";
		}
	}
}
