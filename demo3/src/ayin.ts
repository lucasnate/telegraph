import { ShipInfo } from './ShipInfo';
import { safeDiv } from './safeCalc';
import { kidonInfo } from './kidon';
import { Move } from './Move';
import { ActivationHandler } from './ActivationHandler';

const AYIN_MAX_SPEED = safeDiv(kidonInfo.maxSpeed * 9, 10);
const AYIN_FULL_ACCEL_FRAMES = 20;
const AYIN_ACCEL = safeDiv(AYIN_MAX_SPEED, AYIN_FULL_ACCEL_FRAMES);

export const ayinInfo: ShipInfo = {
	maxHp: 10000,
	maxBatt: 60 * 10,
	maxWarp: 60 * 10,

	maxSpeed: AYIN_MAX_SPEED,
	maxSpeedWithoutUp: safeDiv(kidonInfo.maxSpeed * 4, 10),
	accel: AYIN_ACCEL,

	stablizeAccel: safeDiv(AYIN_ACCEL, 4),
	noStablizeFrames: 180,
	
	activationHandlerMap: new Map<Move, ActivationHandler>(),
	recoveryFrames: new Map<Move, number>()
};
