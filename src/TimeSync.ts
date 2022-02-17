// original:
// https://github.com/pond3r/ggpo/blob/master/src/lib/ggpo/timesync.cpp

const FRAME_WINDOW_SIZE = 40;
const MIN_FRAME_ADVANTAGE = 3;
const MAX_FRAME_ADVANTAGE = 9;

export class TimeSync {

	private local = Array(FRAME_WINDOW_SIZE).fill(0);
	private remote = Array(FRAME_WINDOW_SIZE).fill(0);

	// Differences from GGPO:
	// GGPO also stores inputs, but do we care about them? I'm not even sure if GGPO does.
	// GGPO has a variable called _next_prediction which is not used, I don't bother copying it.

	advanceFrame(frame: number, advantage: number, radvantage: number): void {
		this.local[frame % this.local.length] = advantage;
		this.remote[frame % this.remote.length] = radvantage;
	}

	// Differences from GGPO:
	// the require_idle_input is not implemented. See note above regarding not storing inputs.
	recommendFrameWaitDuration() {
		let i, sum = 0;
		for (i = 0; i < this.local.length; i++) {
			sum += this.local[i];
		}
		let advantage = sum / this.local.length;

		sum = 0;
		for (i = 0; i < this.remote.length; i++) {
			sum += this.remote[i];
		}
		let radvantage = sum / this.remote.length;

		// See if someone should take action.  The person furthest ahead
		// needs to slow down so the other user can catch up.
		// Only do this if both clients agree on who's ahead!!
		if (advantage >= radvantage) {
			return 0;
		}

		let sleepFrames = Math.floor(((radvantage - advantage) / 2) + 0.5);

		// Some things just aren't worth correcting for.  Make sure
		// the difference is relevant before proceeding.
		if (sleepFrames < MIN_FRAME_ADVANTAGE) {
			return 0;
		}

		// Difference from GGPO: Here we would handle inputs if this was the original GGPO.

		console.log('DEBUG: sleepFrames is ' + sleepFrames);
		
		// Success!!! Recommend the number of frames to sleep and adjust
		return Math.min(sleepFrames, MAX_FRAME_ADVANTAGE);
	}
	
}
