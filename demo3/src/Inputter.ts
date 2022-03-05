import { assert } from '../../src/util/assert';
import { keyCodes } from './keyCodes';

const interruptKeyCodes = new Set([
	keyCodes.leftArrow,
	keyCodes.rightArrow,
	keyCodes.upArrow,
	keyCodes.downArrow,
	keyCodes.space,
]);

const abstractKeyAIndex = 0;
const abstractKeyBIndex = 1;
const abstractKeyCIndex = 2;
const abstractKeySwitchIndex = 3;
const abstractKeyUpIndex = 4;
const abstractKeyDownIndex = 5;
const abstractKeyLeftIndex = 6;
const abstractKeyRightIndex = 7;
const abstractKeyCount = 8;

export const abstractKeyAMask = 1 << 0;
export const abstractKeyBMask = 1 << 1;
export const abstractKeyCMask = 1 << 2;
export const abstractKeySwitchMask = 1 << 3;
export const abstractKeyUpMask = 1 << 4;
export const abstractKeyDownMask = 1 << 5;
export const abstractKeyLeftMask = 1 << 6;
export const abstractKeyRightMask = 1 << 7;


export class Inputter {
	private patternIndex: number = 0;
	private abstractKeyMask: number = 0;
	private keyAbstractor: number[];
	
	constructor(keyAbstractor: number[]) {
		assert(keyAbstractor.length === abstractKeyCount, "keyAbstractor is invalid");
		this.keyAbstractor = keyAbstractor;
	}
	
	bind(): void {
		document.addEventListener('keydown',
								  (e) => {
									  if (e.keyCode === this.keyAbstractor[0]) this.abstractKeyMask |= 1;
									  if (e.keyCode === this.keyAbstractor[1]) this.abstractKeyMask |= 2;
									  if (e.keyCode === this.keyAbstractor[2]) this.abstractKeyMask |= 4;
									  if (e.keyCode === this.keyAbstractor[3]) this.abstractKeyMask |= 8;
									  if (e.keyCode === this.keyAbstractor[4]) this.abstractKeyMask |= 16;
									  if (e.keyCode === this.keyAbstractor[5]) this.abstractKeyMask |= 32;
									  if (e.keyCode === this.keyAbstractor[6]) this.abstractKeyMask |= 64;
									  if (e.keyCode === this.keyAbstractor[7]) this.abstractKeyMask |= 128;
									  if (interruptKeyCodes.has(e.keyCode)) {
										  e.preventDefault();
										  return false;
									  }
								  });
		document.addEventListener('keyup',
								  (e) => {
									  if (e.keyCode === this.keyAbstractor[0]) this.abstractKeyMask &= ~1;
									  if (e.keyCode === this.keyAbstractor[1]) this.abstractKeyMask &= ~2;
									  if (e.keyCode === this.keyAbstractor[2]) this.abstractKeyMask &= ~4;
									  if (e.keyCode === this.keyAbstractor[3]) this.abstractKeyMask &= ~8;
									  if (e.keyCode === this.keyAbstractor[4]) this.abstractKeyMask &= ~16;
									  if (e.keyCode === this.keyAbstractor[5]) this.abstractKeyMask &= ~32;
									  if (e.keyCode === this.keyAbstractor[6]) this.abstractKeyMask &= ~64;
									  if (e.keyCode === this.keyAbstractor[7]) this.abstractKeyMask &= ~128;
								  });
	}

	getInputState(): number {
		return this.abstractKeyMask;
	}
}
