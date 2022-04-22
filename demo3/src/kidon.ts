import { ShipInfo } from './ShipInfo';
import { safeDiv, MAX_INT_ANGLE } from './safeCalc';
import { Move } from './Move';
import { Entity, EntityType } from './Entity';
import { KIDON_WIDTH, KIDON_HEIGHT, KIDON_SHOT_A1_WIDTH, KIDON_SHOT_A2_WIDTH } from './shipShapes';
import { assert } from '../../src/util/assert';
import { ActivationHandler } from './ActivationHandler';
import { activateShot, activateLaser } from './gameUtil';

const KIDON_MAX_SPEED = safeDiv(KIDON_HEIGHT, 15);
const KIDON_FULL_ACCEL_FRAMES = 20;
const KIDON_ACCEL = safeDiv(KIDON_MAX_SPEED, KIDON_FULL_ACCEL_FRAMES);

export const KIDON_SHOT_A1_RECOVERY_FRAMES = 4;
export const KIDON_SHOT_A1_ACTIVE_FRAMES = 27;
const KIDON_SHOT_A1_RANGE = KIDON_WIDTH * 4;
export const KIDON_SHOT_A1_SPEED = safeDiv(KIDON_SHOT_A1_RANGE, KIDON_SHOT_A1_ACTIVE_FRAMES);
assert(KIDON_SHOT_A1_SPEED < safeDiv(KIDON_SHOT_A1_WIDTH, 2), "Kidon shot A is too fast! " + KIDON_SHOT_A1_SPEED + "," + KIDON_SHOT_A1_WIDTH);
assert(KIDON_SHOT_A1_SPEED > KIDON_MAX_SPEED * 2, "Kidon shot A is too slow! " + KIDON_SHOT_A1_SPEED + "," + KIDON_MAX_SPEED);


const KIDON_SHOT_A2_RANGE = KIDON_WIDTH * 12;
export const KIDON_SHOT_A2_STARTUP_FRAMES = 8;
export const KIDON_SHOT_A2_ACTIVE_FRAMES = 120;
export const KIDON_SHOT_A2_RECOVERY_FRAMES = 8;
export const KIDON_SHOT_A2_SPEED = safeDiv(KIDON_SHOT_A2_RANGE, KIDON_SHOT_A2_ACTIVE_FRAMES);
assert(KIDON_SHOT_A2_SPEED < safeDiv(KIDON_SHOT_A2_WIDTH, 2), "Kidon shot 2A is too fast! " + KIDON_SHOT_A2_SPEED + "," + KIDON_SHOT_A2_WIDTH);
assert(KIDON_SHOT_A2_SPEED > KIDON_MAX_SPEED, "Kidon shot 2A is too slow! " + KIDON_SHOT_A2_SPEED + "," + KIDON_MAX_SPEED);

export const KIDON_SHOT_B1_ACTIVE_FRAMES = 4;
const KIDON_SHOT_B1_TURN = safeDiv(MAX_INT_ANGLE, 32);

export const KIDON_SHOT_B2_ACTIVE_FRAMES = 5;
const KIDON_SHOT_B2_TURN = safeDiv(MAX_INT_ANGLE, 32);

const KIDON_SHOT_C1_SPEED = safeDiv(KIDON_MAX_SPEED * 12, 10);
const KIDON_SHOT_C1_RANGE = KIDON_WIDTH * 10;
export const KIDON_SHOT_C1_STARTUP_FRAMES = 15;
export const KIDON_SHOT_C1_ACTIVE_FRAMES = safeDiv(KIDON_SHOT_C1_RANGE, KIDON_SHOT_C1_SPEED);
export const KIDON_SHOT_C1_RECOVERY_FRAMES = 30;

const KIDON_SHOT_C2_BIG_SPEED = safeDiv(KIDON_MAX_SPEED * 16, 10);
const KIDON_SHOT_C2_BIG_RANGE = KIDON_WIDTH * 12;
export const KIDON_SHOT_C2_BIG_ACTIVE_FRAMES = safeDiv(KIDON_SHOT_C2_BIG_RANGE, KIDON_SHOT_C2_BIG_SPEED);
export const KIDON_SHOT_C2_STARTUP_FRAMES = 30;
export const KIDON_SHOT_C2_RECOVERY_FRAMES = 25;

export const kidonInfo: ShipInfo = {
	maxHp: 10000,
	maxBatt: 60 * 10,
	maxWarp: 60 * 10,

	maxSpeed: KIDON_MAX_SPEED,
	maxSpeedWithoutUp: safeDiv(KIDON_MAX_SPEED, 3),
	accel: KIDON_ACCEL,

	stablizeAccel: safeDiv(KIDON_ACCEL, 4),
	noStablizeFrames: 180,
	
	activationHandlerMap: new Map<Move, ActivationHandler>([
		[Move.A1, (entity_i: number, entities: Entity[]) => {
			activateShot(entity_i, entities, EntityType.KidonShotA1, KIDON_SHOT_A1_SPEED,
						 KIDON_SHOT_A1_ACTIVE_FRAMES, KIDON_SHOT_A1_RECOVERY_FRAMES, false,
						 safeDiv(KIDON_WIDTH, 2));
		}],
		[Move.A2, (entity_i: number, entities: Entity[]) => {
			activateShot(entity_i, entities, EntityType.KidonShotA2, KIDON_SHOT_A2_SPEED,
						 KIDON_SHOT_A2_ACTIVE_FRAMES, KIDON_SHOT_A2_RECOVERY_FRAMES, false,
						 safeDiv(KIDON_WIDTH, 2));
		}],
		[Move.B1, (entity_i: number, entities: Entity[]) => {
			activateLaser(entity_i, entities, EntityType.KidonShotB1, KIDON_SHOT_B1_ACTIVE_FRAMES,
						  KIDON_SHOT_B1_TURN, true, safeDiv(KIDON_WIDTH, 2));
		}],
		[Move.B2, (entity_i: number, entities: Entity[]) => {
			activateLaser(entity_i, entities, EntityType.KidonShotB2, KIDON_SHOT_B2_ACTIVE_FRAMES, KIDON_SHOT_B2_TURN, false, safeDiv(KIDON_WIDTH, 2));
		}],
		[Move.C1, (entity_i: number, entities: Entity[]) => {
			activateShot(entity_i, entities, EntityType.KidonShotC1Big, KIDON_SHOT_C1_SPEED,
						 KIDON_SHOT_C1_ACTIVE_FRAMES, KIDON_SHOT_C1_RECOVERY_FRAMES, true,
						 safeDiv(KIDON_WIDTH, 2));
		}],
		[Move.C2, (entity_i: number, entities: Entity[]) => {
			activateShot(entity_i, entities, EntityType.KidonShotC2Big, KIDON_SHOT_C2_BIG_SPEED,
						 KIDON_SHOT_C2_BIG_ACTIVE_FRAMES, KIDON_SHOT_C2_RECOVERY_FRAMES, true,
						 safeDiv(KIDON_WIDTH, 2));
		}]]),
		
	recoveryFrames: new Map<Move, number>([
		[Move.B1, 10],
		[Move.B2, 20] 
	])
};
