export function onCopy(cb: () => void): void {
	document.getElementById('copy')!.onclick = cb;
}

export function onOpen(cb: () => void): void {
	document.getElementById('open')!.onclick = cb;
}

export function updateUrlForFriend(peerId: string) : void {
	let url = new URL(window.location.href);
	url.searchParams.set('peer', peerId);
	document.getElementById('url_for_friend')!.innerText = url.href;
}
