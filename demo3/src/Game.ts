import Peer from 'peerjs';
import { GameState, GameSyncData, createGameState, updateGameState } from './GameState';
import {
    Telegraph,
    TelegraphEvent,
    InputValues,
    PlayerType,
    SyncInputResultValue,
    AddLocalInputResult,
} from '../../src';
import { Inputter } from './Inputter';
import { Renderer } from './Renderer';
import { keyCodes } from './keyCodes';
import { hash } from './util/hash';
import deterministicStringify from 'fast-json-stable-stringify';


const FRAME_STEP = 1000 / 60;

class Game {
    private telegraph: Telegraph<string>;
    private renderer = new Renderer();	
    private inputter = new Inputter([keyCodes.z, keyCodes.x, keyCodes.c, keyCodes.s,
									 keyCodes.upArrow, keyCodes.downArrow, keyCodes.leftArrow,
									 keyCodes.rightArrow]);
    private gameState = createGameState();
	private winningSyncData: GameSyncData | null = null;
	private syncCallback: (winningSyncData: GameSyncData) => void = () => {};

	private loopLastTime = 0;
	private loopLastRenderTime = 0;
	private loopLag = 0;
	private loopFps = 0;
	private loopFpsSecond = Math.floor(performance.now() / 1000);
	private loopLastFps = 0;

    private localPlayerHandle: number | null = null;
    private remotePlayerHandle: number | null = null;
	private framesToSleep: number = 0;

	
	constructor(peer: Peer, remotePeerId: string, localPlayerNumber: number, localSyncData: any,
				syncCallback: (winningSyncData: GameSyncData) => void) {
		this.inputter.bind();
		this.telegraph = new Telegraph({
			peer,
			disconnectNotifyStart: 1000,
			disconnectTimeout: 1000 * 60 * 60,
			numPlayers: 2,
			syncData: localSyncData,

			callbacks: {
				onAdvanceFrame: (): void => { this.runRollbackUpdate(); },
				onLoadState: (snapshot): void => { this.gameState = JSON.parse(snapshot); },
				onSaveState: (): string => { return JSON.stringify(this.gameState); },
                onEvent: (evt: TelegraphEvent): void => {
					console.log('[Telegraph]', evt.type);
					if (evt.type == 'connected') {
						console.log('Got connected event in game');
						this.remotePlayerHandle = evt.connected.playerHandle;
					} else if (evt.type == 'synchronized') {
						console.log('Got synchronized event in game');
						this.winningSyncData = this.telegraph.getWinningSyncData() as GameSyncData;
						this.syncCallback(this.winningSyncData);
					} else if (evt.type == 'timesync') {
						if (evt.timesync.framesAhead < 0)
							throw new Error('Negative framesAhead, should be impossible');
						this.framesToSleep += evt.timesync.framesAhead;
					}
				},
				onChecksum: (snapshot): string => {
					return hash(deterministicStringify(JSON.parse(snapshot)));
				}
			}});
		this.gameState = createGameState();
		this.localPlayerHandle = this.telegraph.addPlayer({ playerNumber: localPlayerNumber,
															type: PlayerType.local,
														  }).value!;
		this.telegraph.addPlayer({playerNumber: (3 - localPlayerNumber),
								  type: PlayerType.remote,
								  remote: { peerId: remotePeerId }}).value!;
	}

	private advanceFrame(SyncInputResultValue: SyncInputResultValue): void {
		updateGameState(this.gameState, [SyncInputResultValue.inputs[0][0], SyncInputResultValue.inputs[1][0]], this.winningSyncData!);
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
		const AddLocalInputResult = this.readInput();
		let didRun = false;

		if (!AddLocalInputResult || AddLocalInputResult.code === 'ok') {
			const inputResult = this.telegraph.syncInput();
			if (inputResult.code === 'ok') {
				didRun = true;
				this.advanceFrame(inputResult.value!);
			} else {
				console.log('[Game] non-ok result for syncInput:', inputResult.code);			
			}
		}

		this.telegraph.afterTick();
		return didRun;
	}

    readInput(): AddLocalInputResult | null {
        if (this.localPlayerHandle === null || this.winningSyncData == null) {
            return null;
        }

        const localInputs = [this.inputter.getInputState()];
        return this.telegraph.addLocalInput(
            this.localPlayerHandle,
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

		const delay = this.telegraph.getFrameDelay(this.localPlayerHandle!).value!;
        while (this.loopLag >= FRAME_STEP) {
			if (this.framesToSleep > 0) {
				--this.framesToSleep;
			} else {
				if (this.runFixedUpdate(delay)) {
					let curFpsSecond = Math.floor(performance.now() / 1000);
					if (this.loopFpsSecond === curFpsSecond)
						++this.loopFps;
					else {
						document.getElementById("debug1")!.innerText = this.loopFps.toString();
						this.loopLastFps = this.loopFps;
						this.loopFps = 1;
						this.loopFpsSecond = curFpsSecond;
					}
				}
			}
			this.loopLag -= FRAME_STEP;
        }

        const lagOffset = this.loopLag / FRAME_STEP;
		const networkStats = this.telegraph.getNetworkStats(this.remotePlayerHandle!).value;
		if (isRender) {
			this.renderer.render(this.gameState);
		}
        this.loopLastTime = time;
		if (isRender) {
			this.loopLastRenderTime = time;
			requestAnimationFrame(() => { this.loop(true); });
		}		
	}

    // game loop. see:
    // - https://gist.github.com/godwhoa/e6225ae99853aac1f633
    // - http://gameprogrammingpatterns.com/game-loop.html
    run(): void {
		// Since setTimeout is not always accurate, we use 1000 / 120 instead of 1000 / 60
		setInterval(() => { this.loop(false); }, 1000 / 120);
		requestAnimationFrame(() => { this.loop(true); });
    }

	reset(): void {
		this.telegraph.restart();
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
