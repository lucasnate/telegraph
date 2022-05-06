import { ShipInfo } from './ShipInfo';
import { safeDiv, MAX_INT_ANGLE, safeAtan2 } from './safeCalc';
import { kidonInfo } from './kidon';
import { Move } from './Move';
import { MoveInfo } from './MoveInfo';
import { Entity, EntityType, EntityState, CollisionSide, EntityColor } from './Entity';
import { ActivationHandler } from './ActivationHandler';
import { activateShot, activateShotWithoutRecovery, getEntityState, setEntityState, PLAYER1_INDEX, PLAYER2_INDEX } from './gameUtil';
import { AYIN_WIDTH, AYIN_HELPER_B1_WIDTH } from './shipShapes';
import { assert } from '../../src/util/assert';

const AYIN_SHOT_A1_STARTUP_FRAMES = 7;
export const AYIN_SHOT_A1_RECOVERY_FRAMES = 17;
const AYIN_MAX_SPEED = safeDiv(kidonInfo.maxSpeed * 9, 10);
const AYIN_FULL_ACCEL_FRAMES = 20;
const AYIN_ACCEL = safeDiv(AYIN_MAX_SPEED, AYIN_FULL_ACCEL_FRAMES);
const AYIN_SHOT_A1_SPEED = 0;
const AYIN_SHOT_A1_ACTIVE_FRAMES = 10;
const AYIN_SHOT_A1_START_DISTANCE = AYIN_WIDTH * 7;
export const AYIN_SHOT_A1_BLOCKED_DAMAGE = 100;
export const AYIN_SHOT_A1_HIT_DAMAGE = 1000;


const AYIN_HELPER_B1_LAUNCH_STARTUP_FRAMES = 1;
const AYIN_HELPER_B1_LAUNCH_ACTIVE_FRAMES = 60;
const AYIN_HELPER_B1_LAUNCH_RANGE = AYIN_WIDTH * 7;
const AYIN_HELPER_B1_LAUNCH_SPEED = safeDiv(AYIN_HELPER_B1_LAUNCH_RANGE, AYIN_HELPER_B1_LAUNCH_ACTIVE_FRAMES);
assert(AYIN_HELPER_B1_LAUNCH_SPEED < safeDiv(AYIN_HELPER_B1_WIDTH, 2), "Ayin helper launch is too fast!");
export const AYIN_HELPER_B1_ATTACK_STARTUP_FRAMES = 35;
const AYIN_HELPER_B1_RECOVERY_FRAMES = 30;
const AYIN_HELPER_B1_HP = 800;
const AYIN_HELPER_B1_ATTACK_SHOT_COUNT = 8;
const AYIN_HELPER_B1_ATTACK_SHOT_INTERVAL = 7;
export const AYIN_HELPER_B1_ATTACK_SHOT_SPEED = 230; // About 2/3 of speed of Kidon A2
export const AYIN_HELPER_B1_ATTACK_SHOT_ACTIVE_FRAMES = 135;
export const AYIN_HELPER_B1_ATTACK_SHOT_HOMING_FRAMES = 135;
export const AYIN_HELPER_B1_ATTACK_SHOT_TURN_PER_FRAME = safeDiv(safeDiv(MAX_INT_ANGLE, 4), AYIN_HELPER_B1_ATTACK_SHOT_HOMING_FRAMES);
export const AYIN_HELPER_B1_ATTACK_SHOT_ACCEL_ON_BLOCK = 2;
export const AYIN_HELPER_B1_ATTACK_SHOT_ACCEL_ON_HIT = 4;
export const AYIN_HELPER_B1_ATTACK_SHOT_BLOCKSTUN_FRAMES = 7;
export const AYIN_HELPER_B1_ATTACK_SHOT_HITSTUN_FRAMES = 14;
export const AYIN_HELPER_B1_ATTACK_SHOT_BLOCKED_DAMAGE = 15;
export const AYIN_HELPER_B1_ATTACK_SHOT_HIT_DAMAGE = 150;
export const AYIN_HELPER_B1_MAX_COUNT = 7;
export const AYIN_SHOT_A2_STARTUP_FRAMES = 8;
export const AYIN_SHOT_A2_RECOVERY_FRAMES = 20;
export const AYIN_SHOT_A2_SPEED = 200;
export const AYIN_SHOT_A2_ACTIVE_FRAMES = 480;
export const AYIN_SHOT_A2_HOMING_FRAMES = 480;
export const AYIN_SHOT_A2_BLOCKSTUN_FRAMES = 0; // Never really used
export const AYIN_SHOT_A2_HITSTUN_FRAMES = 240;
export const AYIN_SHOT_A2_BATT_COST = 360;
export const AYIN_SHOT_A2_TURN_PER_FRAME = safeDiv(MAX_INT_ANGLE, 16);
assert(AYIN_SHOT_A2_HITSTUN_FRAMES <= AYIN_SHOT_A2_BATT_COST - (2 * 60), "Hitstun is too long, danger of loops");
export const AYIN_SHOT_C1_COUNT = 5;
export const AYIN_SHOT_C1_STARTUP_FRAMES = 15;
export const AYIN_SHOT_C1_RECOVERY_FRAMES = 30;
export const AYIN_SHOT_C1_SPEED = 150;
export const AYIN_SHOT_C1_ACTIVE_FRAMES = 90;
export const AYIN_SHOT_C1_ACCEL_ON_BLOCK = 75;
export const AYIN_SHOT_C1_ACCEL_ON_HIT = 150;
const AYIN_SHOT_C1_ADVANTAGE_ON_BLOCK = -3;
const AYIN_SHOT_C1_ADVANTAGE_ON_HIT = 16;
export const AYIN_SHOT_C1_HITSTUN_FRAMES = AYIN_SHOT_C1_RECOVERY_FRAMES + AYIN_SHOT_C1_ADVANTAGE_ON_HIT;
assert(AYIN_SHOT_C1_HITSTUN_FRAMES >= 0, "Negative frames");
export const AYIN_SHOT_C1_BLOCKSTUN_FRAMES = AYIN_SHOT_C1_RECOVERY_FRAMES + AYIN_SHOT_C1_ADVANTAGE_ON_BLOCK;
assert(AYIN_SHOT_C1_BLOCKSTUN_FRAMES >= 0, "Negative frames");
export const AYIN_SHOT_C1_HIT_DAMAGE = 500;
export const AYIN_SHOT_C1_BLOCKED_DAMAGE = 50;


	




assert(AYIN_HELPER_B1_ATTACK_SHOT_HITSTUN_FRAMES > safeDiv(AYIN_HELPER_B1_ATTACK_SHOT_INTERVAL * 3, 2), "ayin helper shots should chain");



export const ayinInfo: ShipInfo = {
	maxHp: 10000,
	maxBatt: 60 * 10,
	maxWarp: 60 * 10,

	maxSpeed: AYIN_MAX_SPEED,
	maxSpeedWithoutUp: safeDiv(kidonInfo.maxSpeed * 4, 10),
	accel: AYIN_ACCEL,

	stablizeAccel: safeDiv(AYIN_ACCEL, 4),
	noStablizeFrames: 180,

	moveInfo: new Map<Move, MoveInfo>([
		[Move.A1, {
			startupFrames: AYIN_SHOT_A1_STARTUP_FRAMES,
			recoveryFrames: AYIN_SHOT_A1_RECOVERY_FRAMES, // TODO: This value is duplicated in the parameters for activateShot
			battCost: (AYIN_SHOT_A1_STARTUP_FRAMES + AYIN_SHOT_A1_RECOVERY_FRAMES) * 2,
			handler: (entity_i: number, entities: Entity[]) => {
				activateShot(entity_i, entities, EntityType.AyinShotA1, AYIN_SHOT_A1_SPEED,
							 AYIN_SHOT_A1_ACTIVE_FRAMES, AYIN_SHOT_A1_RECOVERY_FRAMES, EntityColor.Neutral,
							 safeDiv(AYIN_WIDTH, 2) + AYIN_SHOT_A1_START_DISTANCE);
			}
		}],
		[Move.B1, {
			startupFrames: AYIN_HELPER_B1_LAUNCH_STARTUP_FRAMES,
			recoveryFrames: AYIN_HELPER_B1_RECOVERY_FRAMES,
			battCost: (AYIN_HELPER_B1_LAUNCH_STARTUP_FRAMES + AYIN_HELPER_B1_RECOVERY_FRAMES) * 3,
			handler: (entity_i: number, entities: Entity[]) => {
				activateShot(entity_i, entities, EntityType.AyinHelperB1, AYIN_HELPER_B1_LAUNCH_SPEED,
							 AYIN_HELPER_B1_LAUNCH_ACTIVE_FRAMES, AYIN_HELPER_B1_RECOVERY_FRAMES, entities[entity_i].color,
							 safeDiv(AYIN_WIDTH, 2)).hp = AYIN_HELPER_B1_HP;
			}
		}],
		[Move.A2, {
			startupFrames: AYIN_SHOT_A2_STARTUP_FRAMES,
			recoveryFrames: AYIN_SHOT_A2_RECOVERY_FRAMES,
			battCost: AYIN_SHOT_A2_BATT_COST,
			handler: (entity_i: number, entities: Entity[]) => {
				activateShot(entity_i, entities, EntityType.AyinShotA2, AYIN_SHOT_A2_SPEED,
							 AYIN_SHOT_A2_ACTIVE_FRAMES, AYIN_SHOT_A2_RECOVERY_FRAMES, EntityColor.Purple,
							 0);
			}
		}],
		[Move.C1, {
			startupFrames: AYIN_SHOT_C1_STARTUP_FRAMES,
			recoveryFrames: AYIN_SHOT_C1_RECOVERY_FRAMES,
			battCost: (AYIN_SHOT_C1_STARTUP_FRAMES + AYIN_SHOT_C1_RECOVERY_FRAMES) * 3,
			handler: (entity_i: number, entities: Entity[]) => {
				for (let i = 0, l = entities.length; i < l; ++i) {
					if (entities[i].type === EntityType.AyinHelperB1) {
						entities[i].shouldBeRemoved = true;
						// Ugly hack
						if (entities[i].batt === 1)
							entities[i].collisionSide = CollisionSide.PlayerOne;
						else if (entities[i].batt === 2)
							entities[i].collisionSide = CollisionSide.PlayerTwo;
						else
							throw new Error("Unsupported ayin hack batt");
						for (let j = 0; j < AYIN_SHOT_C1_COUNT; ++j) {
							entities[i].angleInt = safeDiv(MAX_INT_ANGLE * j, AYIN_SHOT_C1_COUNT);
							activateShotWithoutRecovery(i, entities, EntityType.AyinShotC1, AYIN_SHOT_C1_SPEED,
														AYIN_SHOT_C1_ACTIVE_FRAMES, entities[i].color,
														safeDiv(AYIN_HELPER_B1_WIDTH, 2));
						}
					}
				}
				setEntityState(entities[entity_i], EntityState.Recovery, AYIN_SHOT_C1_RECOVERY_FRAMES);
			}
		}],
	])
};

export function handleAyinHelperB1State(entity_i: number, entities: Entity[]) {
	const entity = entities[entity_i];
	const state = getEntityState(entity);
	if (state !== EntityState.Idle && --entity.framesToStateChange <= 0) {
		switch (state) {
			case EntityState.Moving:
				entity.vx = entity.vy = 0;
				const enemy = entity.collisionSide === CollisionSide.PlayerOne ? entities[PLAYER2_INDEX] : entities[PLAYER1_INDEX];
				entity.angleInt = safeAtan2(enemy.y - entity.y, enemy.x - entity.x);
				setEntityState(entity, EntityState.Startup, AYIN_HELPER_B1_ATTACK_STARTUP_FRAMES);
				break;
			case EntityState.Startup:
				setEntityState(entity, EntityState.Active, AYIN_HELPER_B1_ATTACK_SHOT_COUNT * AYIN_HELPER_B1_ATTACK_SHOT_INTERVAL + 1);
				break;
			case EntityState.Active:
				let helperCount = 0;
				for (let i = 0, l = entities.length; i < l; ++i)
					if (entities[i].type === EntityType.AyinHelperB1)
						++helperCount;
				if (helperCount > AYIN_HELPER_B1_MAX_COUNT) {
					entity.shouldBeRemoved = true;
				}else {
					setEntityState(entity, EntityState.Idle, 0);
					entity.vx = entity.vy = 0;
					entity.batt = entity.collisionSide === CollisionSide.PlayerOne ? 1 : 2; // hacky as hell
					entity.collisionSide = CollisionSide.None;
				}
				break;
			default:
				throw new Error("Unsupported state for ayin helper");
		}
	} else {
		if (state === EntityState.Active) {
			if (entity.framesToStateChange % AYIN_HELPER_B1_ATTACK_SHOT_INTERVAL === 0) {
				activateShotWithoutRecovery(entity_i, entities, EntityType.AyinHelperB1AttackShot, AYIN_HELPER_B1_ATTACK_SHOT_SPEED,
											AYIN_HELPER_B1_ATTACK_SHOT_ACTIVE_FRAMES, entity.color, safeDiv(AYIN_HELPER_B1_WIDTH, 2));
			}
		}
	}
}
