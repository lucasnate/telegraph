// TODO: This file needs to have float protection

import { Move } from './Move';
import { ActivationHandler } from './ActivationHandler';

export interface ShipInfo {
	maxHp: number,
	maxBatt: number,
	maxWarp: number,
	
	maxSpeed: number,
	maxSpeedWithoutUp: number,
	accel: number,

	stablizeAccel: number,
	noStablizeFrames: number,
	
	activationHandlerMap: Map<Move, ActivationHandler>,
	recoveryFrames: Map<Move, number>,
	
}

