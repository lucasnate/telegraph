import Peer from 'peerjs';
import {
    Telegraph,
    TelegraphEvent,
    InputValues,
    PlayerType,
    SyncInputResultValue,
    AddLocalInputResult,
} from '../../src';
import { TelegraphNetworkStats, SyncData } from '../../src/types';
import { keyCodes } from './util/keyCodes';
import { Inputter } from './util/Inputter';
import { hash } from './util/hash';
import deterministicStringify from 'fast-json-stable-stringify';

const GAME_WIDTH = 640;
const GAME_HEIGHT = 240;
const RECT_WIDTH = 10;
const FRAME_STEP = 1000 / 60;
const MIN_L = 0
const L_CHANGE_FRAMES = 20
const MAX_L = Math.floor(220 / L_CHANGE_FRAMES) * L_CHANGE_FRAMES;

/**
 * Unsynced "non-game" state.
 */
class NonGameState {
    localPlayerHandle: number | null = null;
    remotePlayerHandle: number | null = null;
	framesToSleep: number = 0;
}

class Renderer {
	canvas!: HTMLCanvasElement;
	idealCanvas!: HTMLCanvasElement;
    canvasCtx!: CanvasRenderingContext2D;
    idealCanvasCtx!: CanvasRenderingContext2D;
	
	createCanvas(): void {
		let canvas = document.getElementById('actual_canvas') as HTMLCanvasElement;
		let idealCanvas = document.getElementById('ideal_canvas') as HTMLCanvasElement;
		if (!canvas || !idealCanvas)
			throw new Error('Failed to get canvas');
		for (const c of [canvas, idealCanvas]) {
			c.width = GAME_WIDTH;
			c.height = GAME_HEIGHT;
		}		
		this.canvas = canvas;
		this.idealCanvas = idealCanvas;
		let canvasCtx = this.canvas.getContext('2d');
		let idealCanvasCtx = this.idealCanvas.getContext('2d');
		if (!canvasCtx || !idealCanvasCtx)
			throw new Error('Failed to get ctx');
		this.canvasCtx = canvasCtx;
		this.idealCanvasCtx = idealCanvasCtx;
	}

    render(isIdeal: boolean, state: State, lerp: number, networkStats: TelegraphNetworkStats | null, winningSyncData: GameSyncData, fps: number): void {
		const ctx = isIdeal ? this.idealCanvasCtx : this.canvasCtx;
		// TODO: Should we use lerp?
        ctx.fillStyle = 'black';
        ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
		ctx.fillStyle = 'rgb(255,' + state.l[0] + ',' + state.l[0] + ')';
		ctx.fillRect(state.x[0] - (RECT_WIDTH / 2), 0, RECT_WIDTH + (state.l[0] * (RECT_WIDTH * 5 / MAX_L)), GAME_HEIGHT);
		ctx.fillStyle = 'rgb(' + state.l[1] + ',' + state.l[1] + ',255)';
		ctx.fillRect(state.x[1] - (RECT_WIDTH / 2), 0, RECT_WIDTH + (state.l[1] * (RECT_WIDTH * 5 / MAX_L)), GAME_HEIGHT);
		ctx.fillStyle = 'white';
		ctx.font = '14px serif';
		if (!isIdeal) {
			if (networkStats != null) {
				if (networkStats.remainingDataSyncSteps === 0 && networkStats.remainingTimeSyncSteps === 0) {
					ctx.fillText('Local frame advantage: ' + networkStats.localFrameAdvantage, GAME_WIDTH / 4, GAME_HEIGHT / 4);
					ctx.fillText('Remote frame advantage: ' + networkStats.remoteFrameAdvantage, GAME_WIDTH / 4, GAME_HEIGHT / 4 + 20);
					if (winningSyncData != null) {
						ctx.fillText('Delay frames: ' + winningSyncData.delay, GAME_WIDTH / 4, GAME_HEIGHT / 4 + 40);
						ctx.fillText('Rollback frames: ' + winningSyncData.rollback, GAME_WIDTH / 4, GAME_HEIGHT / 4 + 60);
						ctx.fillText('Key press change interval frames: ' + winningSyncData.keyInterval, GAME_WIDTH / 4, GAME_HEIGHT / 4 + 80);
						ctx.fillText('Distance: ' + winningSyncData.distance, GAME_WIDTH / 4, GAME_HEIGHT / 4 + 100);
						ctx.fillText('Move type: ' + winningSyncData.moveType, GAME_WIDTH / 4, GAME_HEIGHT / 4 + 120);
						ctx.fillText('FPS: ' + fps, GAME_WIDTH / 4, GAME_HEIGHT / 4 + 140);
					}
				} else {
					ctx.fillText('Remaining data sync steps: ' + networkStats.remainingDataSyncSteps, GAME_WIDTH / 4, GAME_HEIGHT / 4);
					ctx.fillText('Remaining time sync steps: ' + networkStats.remainingTimeSyncSteps, GAME_WIDTH / 4, GAME_HEIGHT / 4 + 20);
				}
			} else
				ctx.fillText('No network stats!?', GAME_WIDTH / 2, GAME_HEIGHT / 2);
		} else
			ctx.fillText('ideal', GAME_WIDTH / 2, GAME_HEIGHT / 2);
    }
}

interface State {
	x: number[];
	vx: number[];
	l: number[];
	vl: number[];
	pushedDownZ: boolean[];
}

export interface GameSyncData extends SyncData {
	keyInterval: number;
	distance: number;
	moveType: 'dash' | 'walk';
}

function getAccel(winningSyncData: GameSyncData): number {
	// How to calculate dash accel from distance:
	// d = 2(a + 2a + 3a + ... + (i/2)a)
	// 0.5d = a + 2a + 3a + ... + (i/2)a
	// 0.5d = (1 + i/2)a * i / 4
	// 0.5d = (a + ai/2) * i / 4
	// 0.5d = (ai + aii/2) / 4
	// 0.5d = ai/4 + aii/8
	// 0.5d = a(i/4 + ii/8)
	// 4d = a(2i + ii)
	//   4d
	// -------   = a
	// 2i + ii
	
	const d = winningSyncData.distance;
	const i = winningSyncData.keyInterval;
	return Math.ceil(4 * d / (2 * i + i * i));
}

class GameState {
	private state: State = {
		x: [RECT_WIDTH / 2, (GAME_WIDTH / 2 - RECT_WIDTH / 2)],
		l: [0, 0],
		vx: [0, 0],
		vl: [-(MAX_L / L_CHANGE_FRAMES), -(MAX_L / L_CHANGE_FRAMES)],
		pushedDownZ: [false, false],
	}

    load(snapshot: string): void {
        this.state = JSON.parse(snapshot);
    }

    save(): string {
        return JSON.stringify(this.state);
    }

    getState(): State {
        return this.state;
    }
	
    update(inputs: InputValues[], winningSyncData: GameSyncData): void {
		for (let i = 0; i < 2; ++i) {
			this.state.x[i] += this.state.vx[i];
			if (this.state.vl[i] > 0 && this.state.l[i] < MAX_L)
				this.state.l[i] += this.state.vl[i];
			if (this.state.vl[i] < 0 && this.state.l[i] > MIN_L)
				this.state.l[i] += this.state.vl[i];
			if (inputs[i].includes(keyCodes.rightArrow)) {
				if (winningSyncData.moveType === 'dash')
					this.state.vx[i] += getAccel(winningSyncData);
				else
					this.state.vx[i] = Math.ceil(winningSyncData.distance / winningSyncData.keyInterval);
			}
			if (inputs[i].includes(keyCodes.leftArrow)) {
				if (winningSyncData.moveType === 'dash')				
					this.state.vx[i] -= getAccel(winningSyncData);
				else	
					this.state.vx[i] = -Math.ceil(winningSyncData.distance / winningSyncData.keyInterval);
			}
			if (inputs[i].includes(keyCodes.z) && !this.state.pushedDownZ[i] &&
				((this.state.vl[i] < 0 && this.state.l[i] == MIN_L) || (this.state.vl[i] > 0 && this.state.l[i] == MAX_L))) {
				this.state.vl[i] = -this.state.vl[i];
				this.state.pushedDownZ[i] = true;
			}
			if (!inputs[i].includes(keyCodes.z)) this.state.pushedDownZ[i] = false;
		}
	}
}

class Game {
    private renderer = new Renderer();	
    private inputter = new Inputter();
    private telegraph: Telegraph<string>;
    private gameState = new GameState();
    private idealGameState = new GameState();
    private nonGameState = new NonGameState();
	private winningSyncData: GameSyncData | null = null;
	private syncCallback: (winningSyncData: GameSyncData) => void = () => {};

	private loopLastTime = 0;
	private loopLastRenderTime = 0;
	private loopLag = 0;
	private loopFps = 0;
	private loopFpsSecond = Math.floor(performance.now() / 1000);
	private loopLastFps = 0;

	private audioContext = new AudioContext();
	private oscillator: OscillatorNode | null = null;
	private gain: GainNode | null = null;
	
	constructor(peer: Peer, remotePeerId: string, localPlayerNumber: number, localSyncData: any,
				syncCallback: (winningSyncData: GameSyncData) => void) {
		console.log("DEBUG: In game constructor");
		this.renderer.createCanvas();
		this.inputter.bind();
		this.syncCallback = syncCallback;
		this.telegraph = new Telegraph({
			peer,
            disconnectNotifyStart: 1000,
            disconnectTimeout: 1000 * 60 * 60,
			numPlayers: 2,
            syncData: localSyncData,
			
			callbacks: {
				onAdvanceFrame: (): void => { this.runRollbackUpdate(); },
				onLoadState: (snapshot): void => { this.gameState.load(snapshot); },
				onSaveState: (): string => { return this.gameState.save(); },
                onEvent: (evt: TelegraphEvent): void => {
					console.log('[Telegraph]', evt.type);
					if (evt.type == 'connected') {
						console.log('Got connected event in game');
						this.nonGameState.remotePlayerHandle = evt.connected.playerHandle;
					} else if (evt.type == 'synchronized') {
						console.log('Got synchronized event in game');
						this.winningSyncData = this.telegraph.getWinningSyncData() as GameSyncData;
						this.syncCallback(this.winningSyncData);
					} else if (evt.type == 'timesync') {
						if (evt.timesync.framesAhead < 0)
							throw new Error('Negative framesAhead, should be impossible');
						this.nonGameState.framesToSleep += evt.timesync.framesAhead;
					} else if (evt.type == 'restart') {
						this.resetNonTelegraphs();
					}
					
				},
				onChecksum: (snapshot): string => {
					return hash(deterministicStringify(JSON.parse(snapshot)));
				}				
			}});
		this.idealGameState = new GameState();
		this.gameState = new GameState();
        this.nonGameState.localPlayerHandle = this.telegraph.addPlayer({
            playerNumber: localPlayerNumber,
            type: PlayerType.local,
        }).value!;
		console.log("DEBUG: Doing addPlayer for remote player, localPlayerNumber is ");
		this.telegraph.addPlayer({playerNumber: (3 - localPlayerNumber),
								  type: PlayerType.remote,
								  remote: { peerId: remotePeerId}}).value!;
		
	}

	private advanceFrame(SyncInputResultValue: SyncInputResultValue): void {
		this.gameState.update(SyncInputResultValue.inputs, this.winningSyncData!);
		this.telegraph.advanceFrame();
	}
	
	private runRollbackUpdate(): void {
		const inputResult = this.telegraph.syncInput();
        if (!inputResult.value)
            throw new Error( `rollback failure: missing input, code ${inputResult.code}` );
        // console.log('rollback input', inputResult.value.inputs);
		this.advanceFrame(inputResult.value);
	}

    private runFixedUpdate(delay: number): boolean {
        const addLocalInputResult = this.readInput();
		let didRun = false;
		
        if (!addLocalInputResult || addLocalInputResult.code === 'ok') {
            const inputResult = this.telegraph.syncInput();
            if (inputResult.code === 'ok') {
				didRun = true;
                this.advanceFrame(inputResult.value!);
				this.idealGameState.update([this.inputter.getInputStateWithoutZAndFakeDelay(delay, this.winningSyncData!.keyInterval, this.winningSyncData!.moveType),
											this.inputter.getInputStateWithoutZAndFakeDelay(delay, this.winningSyncData!.keyInterval, this.winningSyncData!.moveType)],
										   this.winningSyncData!);
				this.inputter.nextPatternInputFrame();
            } else {
                console.log('[Game] non-ok result for syncInput:', inputResult.code);
            }
        }

        this.telegraph.afterTick();
		return didRun;
    }

    readInput(): AddLocalInputResult | null {
        if (this.nonGameState.localPlayerHandle === null || this.winningSyncData == null) {
            return null;
        }

        const localInputs = this.inputter.getInputState(this.winningSyncData!.keyInterval, this.winningSyncData!.moveType);
        return this.telegraph.addLocalInput(
            this.nonGameState.localPlayerHandle,
            localInputs
        );
    }


        /**
         * The "real" (RAF-bound) run loop.
         */
	loop(isRender: boolean): void {
        // Compute delta and elapsed time
        const time = performance.now();
        const delta = time - this.loopLastTime;

		// Only start calling non-render loop if we are no longer rendering (user switched tab)
		if (!isRender && time - this.loopLastRenderTime < 1000 / 60 * 5)
			return;

        if (delta > 1000 * 60 * 60 * 24) {
            // TODO: if this happens... might have other options? idk
            throw new Error('unrecoverable time delta');
        }
        this.loopLag += delta;
		
		const delay = this.telegraph.getFrameDelay(this.nonGameState.localPlayerHandle!).value!;
        while (this.loopLag >= FRAME_STEP) {
			if (this.nonGameState.framesToSleep > 0) {
				--this.nonGameState.framesToSleep;
			} else {
				if (this.runFixedUpdate(delay)) {
					let curFpsSecond = Math.floor(performance.now() / 1000);
					if (this.loopFpsSecond === curFpsSecond)
						++this.loopFps;
					else {
						this.loopLastFps = this.loopFps;
						this.loopFps = 1;
						this.loopFpsSecond = curFpsSecond;
					}
				}
			}
			this.loopLag -= FRAME_STEP;
        }
		
        const lagOffset = this.loopLag / FRAME_STEP;
		const networkStats = this.telegraph.getNetworkStats(this.nonGameState.remotePlayerHandle!).value;
		if (isRender) {
			this.renderer.render(false, this.gameState.getState(), lagOffset, networkStats, this.winningSyncData!, this.loopLastFps);
			this.renderer.render(true, this.idealGameState.getState(), lagOffset, networkStats, this.winningSyncData!, this.loopLastFps);
		}
		
        this.loopLastTime = time;
		if (isRender) {
			this.loopLastRenderTime = time;
			requestAnimationFrame(() => { this.loop(true); });
		}
	}

	startSound() {
		let interval:null | ReturnType<typeof setInterval> = null;
		let impl = () => {
			console.log("Rerunning sound thingy");
			var ctx = this.audioContext;
			if (this.oscillator != null) {
				this.oscillator.stop(0);
				try {
					this.oscillator.disconnect(ctx.destination);
				} catch (error) {}
				this.oscillator = null;
			}
			if (this.gain != null) {
				try {
					this.gain.disconnect(ctx.destination);
				} catch (error) {}
				this.gain = null;
			}
			var o = this.oscillator = ctx.createOscillator();
			o.frequency.value = 200;
			let g = this.gain = ctx.createGain();
			g.gain.value = 0.01;
			o.start(0);
			o.connect(g).connect(ctx.destination);

			if (document.visibilityState == "visible" && interval != null)
				clearInterval(interval);
		};
		interval = setInterval(impl, 1000);
	}
	
    // game loop. see:
    // - https://gist.github.com/godwhoa/e6225ae99853aac1f633
    // - http://gameprogrammingpatterns.com/game-loop.html
    run(): void {
		// Without sound, chrome will pause JS on this window if it is focused away from
		this.startSound();
		
		// Since setTimeout is not always accurate, we use 1000 / 120 instead of 1000 / 60
		setInterval(() => { this.loop(false); }, 1000 / 120);
		requestAnimationFrame(() => { this.loop(true); });
    }

	reset(): void {
		this.telegraph.restart();
		this.resetNonTelegraphs();
	}

	resetNonTelegraphs(): void {
		this.inputter.reset();
		this.idealGameState = new GameState();
	}

	setLocalSyncData(localSyncData: any): void {
		this.telegraph.setLocalSyncData(localSyncData);
	}
}

let game: Game;

export function createGame(
	peer: Peer,
	remotePeerId: string,
	localPlayerNumber: number,
	localSyncData: any,
	syncCallback: (winningSyncData: GameSyncData) => void
): void {
	game = new Game(peer, remotePeerId, localPlayerNumber, localSyncData, syncCallback);
	game.run();
}

export function resetGame(localSyncData: any) {
	if (game != null) {
		game.setLocalSyncData(localSyncData);
		game.reset();
	}
}
	
