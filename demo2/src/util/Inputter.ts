import { assert } from '../../../src/util/assert';
import { InputValues } from '../../../src';
import { keyCodes } from './keyCodes';

const interruptKeyCodes = new Set([
	keyCodes.leftArrow,
	keyCodes.rightArrow,
	keyCodes.upArrow,
	keyCodes.downArrow,
	keyCodes.space,
]);

// We switched to a dynamic pattern, leaving this here purely as an explanation:
// const PATTERN = [keyCodes.rightArrow, keyCodes.rightArrow, keyCodes.rightArrow, keyCodes.rightArrow,
// 				 keyCodes.rightArrow, keyCodes.rightArrow, keyCodes.rightArrow, keyCodes.rightArrow,
// 				 keyCodes.leftArrow, keyCodes.leftArrow, keyCodes.leftArrow, keyCodes.leftArrow,
// 				 keyCodes.leftArrow, keyCodes.leftArrow, keyCodes.leftArrow, keyCodes.leftArrow,
// 				 keyCodes.leftArrow, keyCodes.leftArrow, keyCodes.leftArrow, keyCodes.leftArrow,
// 				 keyCodes.leftArrow, keyCodes.leftArrow, keyCodes.leftArrow, keyCodes.leftArrow,
// 				 keyCodes.rightArrow, keyCodes.rightArrow, keyCodes.rightArrow, keyCodes.rightArrow,
// 				 keyCodes.rightArrow, keyCodes.rightArrow, keyCodes.rightArrow, keyCodes.rightArrow];

export class Inputter {
	private patternIndex: number = 0;
	private hasButton: boolean = false;

	bind(): void {
		document.addEventListener('keydown',
								  (e) => {
									  if (e.keyCode === keyCodes.z) {
										  this.hasButton = true;
									  }
								  });
		document.addEventListener('keyup',
								  (e) => {
									  if (e.keyCode === keyCodes.z) {
										  this.hasButton = false;
									  }
								  });
	}

	private getInputStateWithSpecificPhase(keyInterval: number, phase: number, moveType: 'dash' | 'walk') {
		if (moveType === 'dash') {
			if (phase < keyInterval / 2) {
				return keyCodes.rightArrow;
			} else if (phase < keyInterval / 2 + keyInterval) {
				return keyCodes.leftArrow; 
			} else {
				return keyCodes.rightArrow;
			}
		} else {
			return phase < keyInterval ? keyCodes.rightArrow : keyCodes.leftArrow;
		}
	}
	
	/** export input state to telegraph format */
    getInputState(keyInterval: number, moveType: 'dash' | 'walk'): InputValues {
		assert(keyInterval % 2 === 0 && keyInterval > 0, 'Key interval must be even and positive');

		const phase = this.patternIndex % (keyInterval * 2);
		let ret = [this.getInputStateWithSpecificPhase(keyInterval, phase, moveType)];
		if (this.hasButton) {
			ret.push(keyCodes.z);
		}
		return ret;
	}

	getInputStateWithoutZAndFakeDelay(delay: number, keyInterval: number, moveType: 'dash' | 'walk'): InputValues {
		assert(keyInterval % 2 === 0 && keyInterval > 0, 'Key interval must be even and positive');
		if (this.patternIndex < delay)
			return []
		let ret = [this.getInputStateWithSpecificPhase(keyInterval, (this.patternIndex - delay) % (keyInterval * 2), moveType)];
		return ret;
	}

	nextPatternInputFrame(): void {
		++this.patternIndex;
	}

	reset(): void {
		this.patternIndex = 0;
	}
	
}
