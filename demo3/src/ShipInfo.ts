// TODO: This file needs to have float protection

import { Move } from './Move';
import { MoveInfo } from './MoveInfo';

export interface ShipInfo {
	maxHp: number,
	maxBatt: number,
	maxWarp: number,
	
	maxSpeed: number,
	maxSpeedWithoutUp: number,
	accel: number,

	stablizeAccel: number,
	noStablizeFrames: number,

	moveInfo: Map<Move, MoveInfo>
}

