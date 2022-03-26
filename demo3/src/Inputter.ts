import { assert } from '../../src/util/assert';
import { keyCodes } from './keyCodes';

const interruptKeyCodes = new Set([
	keyCodes.leftArrow,
	keyCodes.rightArrow,
	keyCodes.upArrow,
	keyCodes.downArrow,
	keyCodes.space,
]);

const abstractKeyA1Index    = 0;
const abstractKeyB1Index    = 1;
const abstractKeyC1Index    = 2;
const abstractKeyA2Index    = 3;
const abstractKeyB2Index    = 4;
const abstractKeyC2Index    = 5;
const abstractKeyUpIndex    = 6;
const abstractKeyDownIndex  = 7;
const abstractKeyLeftIndex  = 8;
const abstractKeyRightIndex = 9;
const abstractKeyRedIndex   = 10;
const abstractKeyBlueIndex  = 11;
const abstractKeyCount      = 12;

export const abstractKeyA1Mask    = 1 << 0;
export const abstractKeyB1Mask    = 1 << 1;
export const abstractKeyC1Mask    = 1 << 2;
export const abstractKeyA2Mask    = 1 << 3;
export const abstractKeyB2Mask    = 1 << 4;
export const abstractKeyC2Mask    = 1 << 5;
export const abstractKeyUpMask    = 1 << 6;
export const abstractKeyDownMask  = 1 << 7;
export const abstractKeyLeftMask  = 1 << 8;
export const abstractKeyRightMask = 1 << 9;
export const abstractKeyRedMask   = 1 << 10;
export const abstractKeyBlueMask  = 1 << 11;


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
									  if (e.keyCode === this.keyAbstractor[0])  this.abstractKeyMask |= 1;
									  if (e.keyCode === this.keyAbstractor[1])  this.abstractKeyMask |= 2;
									  if (e.keyCode === this.keyAbstractor[2])  this.abstractKeyMask |= 4;
									  if (e.keyCode === this.keyAbstractor[3])  this.abstractKeyMask |= 8;
									  if (e.keyCode === this.keyAbstractor[4])  this.abstractKeyMask |= 16;
									  if (e.keyCode === this.keyAbstractor[5])  this.abstractKeyMask |= 32;
									  if (e.keyCode === this.keyAbstractor[6])  this.abstractKeyMask |= 64;
									  if (e.keyCode === this.keyAbstractor[7])  this.abstractKeyMask |= 128;
									  if (e.keyCode === this.keyAbstractor[8])  this.abstractKeyMask |= 256;
									  if (e.keyCode === this.keyAbstractor[9])  this.abstractKeyMask |= 512;
									  if (e.keyCode === this.keyAbstractor[10]) this.abstractKeyMask |= 1024;
									  if (e.keyCode === this.keyAbstractor[11]) this.abstractKeyMask |= 2048;
									  if (interruptKeyCodes.has(e.keyCode)) {
										  e.preventDefault();
										  return false;
									  }
								  });
		document.addEventListener('keyup',
								  (e) => {
									  if (e.keyCode === this.keyAbstractor[0])  this.abstractKeyMask &= ~1;
									  if (e.keyCode === this.keyAbstractor[1])  this.abstractKeyMask &= ~2;
									  if (e.keyCode === this.keyAbstractor[2])  this.abstractKeyMask &= ~4;
									  if (e.keyCode === this.keyAbstractor[3])  this.abstractKeyMask &= ~8;
									  if (e.keyCode === this.keyAbstractor[4])  this.abstractKeyMask &= ~16;
									  if (e.keyCode === this.keyAbstractor[5])  this.abstractKeyMask &= ~32;
									  if (e.keyCode === this.keyAbstractor[6])  this.abstractKeyMask &= ~64;
									  if (e.keyCode === this.keyAbstractor[7])  this.abstractKeyMask &= ~128;
									  if (e.keyCode === this.keyAbstractor[8])  this.abstractKeyMask &= ~256;
									  if (e.keyCode === this.keyAbstractor[9])  this.abstractKeyMask &= ~512;
									  if (e.keyCode === this.keyAbstractor[10]) this.abstractKeyMask &= ~1024;
									  if (e.keyCode === this.keyAbstractor[11]) this.abstractKeyMask &= ~2048;
								  });
	}

	getInputState(): number {
		return this.abstractKeyMask;
	}
}
