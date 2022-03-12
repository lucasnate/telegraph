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

export function hideCanvas(): void {
	document.getElementById('glCanvas')!.style.display = 'none';
	document.getElementById('player1Canvas')!.style.display = 'none';
	document.getElementById('player2Canvas')!.style.display = 'none';
}

export function showCanvas(): void {
	document.getElementById('glCanvas')!.style.display = 'block';
	document.getElementById('player1Canvas')!.style.display = 'block';
	document.getElementById('player2Canvas')!.style.display = 'block';
	resizeCanvas();
}

function resizeCanvas(): void {
	const canvas = document.getElementById('glCanvas')! as HTMLCanvasElement;
	const size = Math.min(window.innerWidth, window.innerHeight);
	canvas.width = canvas.height = size;
	const left = ((window.innerWidth - size) / 2);
	const top = ((window.innerHeight - size) / 2);
	canvas.style.left = left.toString() + 'px';
	canvas.style.top = top.toString() + 'px';
	(document.getElementById('glCanvas') as HTMLCanvasElement).getContext("webgl")!.viewport(0, 0, canvas.width, canvas.height);

	const player1Canvas = document.getElementById('player1Canvas')! as HTMLCanvasElement;
	const player2Canvas = document.getElementById('player2Canvas')! as HTMLCanvasElement;
	player2Canvas.width = player1Canvas.width = top === 0 ? left : window.innerWidth;
	player2Canvas.height = player1Canvas.height = top === 0 ? window.innerHeight : top;
	player1Canvas.style.left = player1Canvas.style.top = '0px';
	player2Canvas.style.left = (window.innerWidth - player2Canvas.width).toString() + 'px';
	player2Canvas.style.top = (window.innerHeight - player2Canvas.height).toString() + 'px';


}
document.addEventListener('fullscreenchange', resizeCanvas);
window.addEventListener('resize', resizeCanvas);
hideCanvas();
