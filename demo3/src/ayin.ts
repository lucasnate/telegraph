import { ShipInfo } from './ShipInfo';
import { safeDiv, MAX_INT_ANGLE, safeAtan2, abs, angleDiff, norm2sq, safeSqrt, normalizeAngle, arithSeriesSum, min, safeCosMul, safeSinMul } from './safeCalc';
import { kidonInfo } from './kidon';
import { Move } from './Move';
import { MoveInfo } from './MoveInfo';
import { Entity, EntityType, EntityState, CollisionSide, EntityColor } from './Entity';
import { ActivationHandler } from './ActivationHandler';
import { activateShot, activateShotWithoutRecovery, getEntityState, setEntityState, PLAYER1_INDEX, PLAYER2_INDEX, doEntityAccel, tryStartupWeapon, renderEntityWarp, isUsingMove } from './gameUtil';
import { AYIN_WIDTH, AYIN_HELPER_B1_WIDTH, AYIN_HELPER_B2_WIDTH, AYIN_SHOT_C2_BASE_HEIGHT } from './shipShapes';
import { Renderable, RenderableType } from './Renderable';
import { assert } from '../../src/util/assert';
import { Color } from './Color';

const AYIN_SHOT_A1_STARTUP_FRAMES = 7;
export const AYIN_SHOT_A1_RECOVERY_FRAMES = 17;
const AYIN_MAX_SPEED = safeDiv(kidonInfo.maxSpeed * 9, 10);
const AYIN_FULL_ACCEL_FRAMES = 20;
const AYIN_ACCEL = safeDiv(AYIN_MAX_SPEED, AYIN_FULL_ACCEL_FRAMES);
const AYIN_SHOT_A1_SPEED = 0;
const AYIN_SHOT_A1_ACTIVE_FRAMES = 10;
const AYIN_SHOT_A1_START_DISTANCE = AYIN_WIDTH * 6;
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
assert(AYIN_HELPER_B1_ATTACK_SHOT_HITSTUN_FRAMES > safeDiv(AYIN_HELPER_B1_ATTACK_SHOT_INTERVAL * 3, 2), "ayin helper shots should chain");
export const AYIN_SHOT_A2_STARTUP_FRAMES = 8;
export const AYIN_SHOT_A2_RECOVERY_FRAMES = 20;
export const AYIN_SHOT_A2_SPEED = 150;
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

const AYIN_SHOT_C2_SPEED = 0;
export const AYIN_SHOT_C2_STARTUP_FRAMES = 22;
export const AYIN_SHOT_C2_RECOVERY_FRAMES = 45;
export const AYIN_SHOT_C2_ACTIVE_FRAMES = 10;
export const AYIN_SHOT_C2_HIT_DAMAGE = 2000;
export const AYIN_SHOT_C2_BLOCKED_DAMAGE = 200;
export const AYIN_SHOT_C2_ACCEL_ON_BLOCK = 40;
export const AYIN_SHOT_C2_ACCEL_ON_HIT = 80;
const AYIN_SHOT_C2_ADVANTAGE_ON_BLOCK = -40;
const AYIN_SHOT_C2_ADVANTAGE_ON_HIT = -20;
export const AYIN_SHOT_C2_HITSTUN_FRAMES = AYIN_SHOT_C2_RECOVERY_FRAMES + AYIN_SHOT_C2_ADVANTAGE_ON_HIT;
assert(AYIN_SHOT_C2_HITSTUN_FRAMES >= 0, "Negative frames");
export const AYIN_SHOT_C2_BLOCKSTUN_FRAMES = AYIN_SHOT_C2_RECOVERY_FRAMES + AYIN_SHOT_C2_ADVANTAGE_ON_BLOCK;
assert(AYIN_SHOT_C2_BLOCKSTUN_FRAMES >= 0, "Negative frames");
export const AYIN_SHOT_C2_FADE_FRAMES = 20; 

const AYIN_HELPER_B2_STARTUP_FRAMES = 1;
const AYIN_HELPER_B2_RECOVERY_FRAMES = 40;
const AYIN_HELPER_B2_LAUNCH_SPEED = 800;
const AYIN_HELPER_B2_LAUNCH_FRAMES = 60;
const AYIN_HELPER_B2_SLOWDOWN_FRAMES = 20;
const AYIN_HELPER_B2_REAL_RETURN_FRAMES = 140; // Can end earlier if it returns quicker.
const AYIN_HELPER_B2_RETURN_FRAMES = AYIN_HELPER_B2_SLOWDOWN_FRAMES + AYIN_HELPER_B2_REAL_RETURN_FRAMES;
const AYIN_HELPER_B2_ACTIVE_FRAMES = AYIN_HELPER_B2_LAUNCH_FRAMES + AYIN_HELPER_B2_RETURN_FRAMES;
const AYIN_HELPER_B2_RETURN_ACCEL = safeDiv(AYIN_HELPER_B2_LAUNCH_SPEED, AYIN_HELPER_B2_SLOWDOWN_FRAMES);
const AYIN_HELPER_B2_RANGE =
	AYIN_HELPER_B2_LAUNCH_SPEED * AYIN_HELPER_B2_LAUNCH_FRAMES +
	arithSeriesSum(AYIN_HELPER_B2_LAUNCH_SPEED, 0, -AYIN_HELPER_B2_RETURN_ACCEL);
assert(AYIN_HELPER_B2_RANGE === 56400, "Inaccurate range: should be " + AYIN_HELPER_B2_RANGE.toString());
const AYIN_HELPER_B2_RETURN_SPEED = 450;
const AYIN_HELPER_B2_HP = 800;
const AYIN_HELPER_B2_ATTACK_SHOT_COUNT = 8;
export const AYIN_HELPER_B2_ATTACK_SHOT_SPEED = 345; // about 3/2 from B1 attack shot
export const AYIN_HELPER_B2_ATTACK_SHOT_ACTIVE_FRAMES = 30;
export const AYIN_HELPER_B2_ATTACK_SHOT_ACCEL_ON_BLOCK = 6;
export const AYIN_HELPER_B2_ATTACK_SHOT_ACCEL_ON_HIT = 18;
export const AYIN_HELPER_B2_ATTACK_SHOT_BLOCKSTUN_FRAMES = 7;
export const AYIN_HELPER_B2_ATTACK_SHOT_HITSTUN_FRAMES = 14;
export const AYIN_HELPER_B2_ATTACK_SHOT_BLOCKED_DAMAGE = 22;
export const AYIN_HELPER_B2_ATTACK_SHOT_HIT_DAMAGE = 150;
export const AYIN_HELPER_B2_ATTACK_SHOT_HOMING_FRAMES = 8;
export const AYIN_HELPER_B2_ATTACK_SHOT_TURN_PER_FRAME = safeDiv(MAX_INT_ANGLE, 16);

const AYIN_HELPER_B1_WARP_COST = 420;
const AYIN_HELPER_B1_WARP_SPEED = safeDiv(AYIN_HELPER_B1_LAUNCH_SPEED * 3, 2);
const AYIN_HELPER_B1_WARP_ACTIVE_FRAMES = 40;
assert(safeDiv(AYIN_HELPER_B1_WARP_ACTIVE_FRAMES * 3, 2) === AYIN_HELPER_B1_LAUNCH_ACTIVE_FRAMES,
	   "Assuming relation of 3/2 for ayin helper b1 warp");
const AYIN_HELPER_B1_WARP_RECOVERY_FRAMES = AYIN_HELPER_B1_WARP_ACTIVE_FRAMES + 10;

// Ugly hack
export function getCollisionSidePossiblyFromBatt(entity: Entity) {
	switch (entity.collisionSide) {
		case CollisionSide.PlayerOne:
		case CollisionSide.PlayerTwo:
			return entity.collisionSide;
		case CollisionSide.None:
			break;
		default:
			console.log(entity);
			throw new Error("Unsupported ayin collision side: " + entity.collisionSide);
	}
	switch (entity.batt) {
		case 1:
			return CollisionSide.PlayerOne;
		case 2:
			return CollisionSide.PlayerTwo;
		default:
			throw new Error("Unsupported ayin hack batt");
	}
}

function setAyinCollisionSideFromBatt(entity: Entity) {
	entity.collisionSide = getCollisionSidePossiblyFromBatt(entity);
}

// Ugly hack
function setBattFromAyinCollisionSide(entity: Entity) {
	entity.batt = entity.collisionSide === CollisionSide.PlayerOne ? 1 : 2; // ugly hack
	entity.collisionSide = CollisionSide.None;
}

function isFriendlyAyinHelperB1(owner: Entity, helper: Entity) {
	return helper.type === EntityType.AyinHelperB1 &&
		getCollisionSidePossiblyFromBatt(helper) === owner.collisionSide;
}

export const ayinInfo: ShipInfo = {
	maxHp: 10000,
	maxBatt: 60 * 10,
	maxWarp: AYIN_HELPER_B1_WARP_COST,

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
			warpCost: 0,
			canCancel: false,
			onTryStartup: tryStartupWeapon,
			onActivation: (entity_i: number, entities: Entity[]) => {
				activateShot(entity_i, entities, EntityType.AyinShotA1, AYIN_SHOT_A1_SPEED,
							 AYIN_SHOT_A1_ACTIVE_FRAMES, AYIN_SHOT_A1_RECOVERY_FRAMES, EntityColor.Neutral,
							 safeDiv(AYIN_WIDTH, 2) + AYIN_SHOT_A1_START_DISTANCE);
			}
		}],
		[Move.B1, {
			startupFrames: AYIN_HELPER_B1_LAUNCH_STARTUP_FRAMES,
			recoveryFrames: AYIN_HELPER_B1_RECOVERY_FRAMES,
			battCost: (AYIN_HELPER_B1_LAUNCH_STARTUP_FRAMES + AYIN_HELPER_B1_RECOVERY_FRAMES) * 3,
			warpCost: 0,
			canCancel: false,
			onTryStartup: tryStartupWeapon,
			onActivation: (entity_i: number, entities: Entity[]) => {
				activateShot(entity_i, entities, EntityType.AyinHelperB1, AYIN_HELPER_B1_LAUNCH_SPEED,
							 AYIN_HELPER_B1_LAUNCH_ACTIVE_FRAMES, AYIN_HELPER_B1_RECOVERY_FRAMES, entities[entity_i].color,
							 safeDiv(AYIN_WIDTH, 2)).hp = AYIN_HELPER_B1_HP;
			}
		}],
		[Move.A2, {
			startupFrames: AYIN_SHOT_A2_STARTUP_FRAMES,
			recoveryFrames: AYIN_SHOT_A2_RECOVERY_FRAMES,
			battCost: AYIN_SHOT_A2_BATT_COST,
			warpCost: 0,
			canCancel: false,
			onTryStartup: tryStartupWeapon,
			onActivation: (entity_i: number, entities: Entity[]) => {
				activateShot(entity_i, entities, EntityType.AyinShotA2, AYIN_SHOT_A2_SPEED,
							 AYIN_SHOT_A2_ACTIVE_FRAMES, AYIN_SHOT_A2_RECOVERY_FRAMES, EntityColor.Purple,
							 0);
			}
		}],
		[Move.B2, {
			startupFrames: AYIN_HELPER_B2_STARTUP_FRAMES,
			recoveryFrames: AYIN_HELPER_B2_RECOVERY_FRAMES,
			battCost: (AYIN_HELPER_B2_STARTUP_FRAMES + AYIN_HELPER_B2_RECOVERY_FRAMES) * 4,
			warpCost: 0,
			canCancel: true, // This is true because we want to be able to detonate it every time. It's not a real cancel.
			onTryStartup: tryStartupAyinB2,
			onActivation: (entity_i: number, entities: Entity[]) => {
				activateShot(entity_i, entities, EntityType.AyinHelperB2, AYIN_HELPER_B2_LAUNCH_SPEED, AYIN_HELPER_B2_ACTIVE_FRAMES, AYIN_HELPER_B2_RECOVERY_FRAMES, entities[entity_i].color,
							 safeDiv(AYIN_WIDTH, 2)).hp = AYIN_HELPER_B2_HP;
			}
		}],
		[Move.C1, {
			startupFrames: AYIN_SHOT_C1_STARTUP_FRAMES,
			recoveryFrames: AYIN_SHOT_C1_RECOVERY_FRAMES,
			battCost: (AYIN_SHOT_C1_STARTUP_FRAMES + AYIN_SHOT_C1_RECOVERY_FRAMES) * 3,
			warpCost: 0,
			canCancel: false,
			onTryStartup: tryStartupWeapon,
			onActivation: (entity_i: number, entities: Entity[]) => {
				for (let i = 0, l = entities.length; i < l; ++i) {
					if (isFriendlyAyinHelperB1(entities[entity_i], entities[i]) &&
						getEntityState(entities[i]) === EntityState.Idle) {
						entities[i].shouldBeRemoved = true;
						setAyinCollisionSideFromBatt(entities[i]);
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
		[Move.C2, {
			startupFrames: AYIN_SHOT_C2_STARTUP_FRAMES,
			recoveryFrames: AYIN_SHOT_C2_RECOVERY_FRAMES,
			battCost: (AYIN_SHOT_C2_STARTUP_FRAMES + AYIN_SHOT_C2_RECOVERY_FRAMES) * 3,
			warpCost: 0,
			canCancel: false,
			onTryStartup: tryStartupWeapon,
			onActivation: (entity_i: number, entities: Entity[]) => {
				let chosen_i = -1;
				let chosenLaserAbsDiff = MAX_INT_ANGLE;
				let chosenLaserRealDiff = MAX_INT_ANGLE;
				let chosenLaserAngle = -1;
				const entity = entities[entity_i];
				const enemy = entities[entity_i === PLAYER1_INDEX ? PLAYER2_INDEX : PLAYER1_INDEX];
				const angle = safeAtan2(enemy.y - entity.y, enemy.x - entity.x);
				for (let i = 0, l = entities.length; i < l; ++i) {
					if (isFriendlyAyinHelperB1(entity, entities[i]) &&
						getEntityState(entities[i]) === EntityState.Idle) {
						const laserAngle = safeAtan2(entities[i].y - entity.y,
													 entities[i].x - entity.x);
						const laserAngleRealDiff = angleDiff(angle, laserAngle);
						const laserAngleAbsDiff = abs(laserAngleRealDiff);
						if (laserAngleAbsDiff < chosenLaserAbsDiff) {
							chosen_i = i;
							chosenLaserRealDiff = laserAngleRealDiff;
							chosenLaserAbsDiff = laserAngleAbsDiff;
							chosenLaserAngle = laserAngle;
						}
					}
				}
				if (chosen_i === -1) {
					setEntityState(entity, EntityState.Recovery, AYIN_SHOT_C2_RECOVERY_FRAMES);
					return;
				}
				entities[chosen_i].shouldBeRemoved = true;
				let chosenDistance = (safeSqrt(norm2sq(entity.x - entities[chosen_i].x,
													   entity.y - entities[chosen_i].y)) +
					                  safeDiv(AYIN_HELPER_B1_WIDTH, 2));
				const shot = activateShot(entity_i, entities, EntityType.AyinShotC2, AYIN_SHOT_C2_SPEED,
										  AYIN_SHOT_C2_ACTIVE_FRAMES, AYIN_SHOT_C2_RECOVERY_FRAMES, EntityColor.Neutral,
										  0);
				shot.x = safeDiv(entity.x + entities[chosen_i].x, 2);
				shot.y = safeDiv(entity.y + entities[chosen_i].y, 2);
				shot.angleInt = normalizeAngle(chosenLaserAngle + (chosenLaserRealDiff > 0 ? safeDiv(MAX_INT_ANGLE, 4) : -safeDiv(MAX_INT_ANGLE, 4)))
				shot.scaleHeightPct = safeDiv(100 * chosenDistance, AYIN_SHOT_C2_BASE_HEIGHT);
			}
		}],
		[Move.WarpUp, makeWarpMoveInfo(true)],
		[Move.WarpDown, makeWarpMoveInfo(false)],
	])
};

function makeWarpMoveInfo(isOffensive: boolean) {
	return {
		startupFrames: 1, // should start immediately
		recoveryFrames: AYIN_HELPER_B1_WARP_RECOVERY_FRAMES,
		battCost: 0,
		warpCost: AYIN_HELPER_B1_WARP_COST,
		canCancel: false,
		onTryStartup: tryStartupWeapon,
		onActivation: (entity_i: number, entities: Entity[]) => {
			doAyinWarp(entity_i, entities, isOffensive);
		}
	};
}

function doAyinWarp(entity_i: number, entities: Entity[], isOffensive: boolean) {
	const enemy = entities[entity_i === PLAYER1_INDEX ? PLAYER2_INDEX : PLAYER1_INDEX];
	const entity = entities[entity_i];
	let sumDx = 0;
	let sumDy = 0;
	let angle = 0;
	let helperCount = 0;
	for (let i = 0, l = entities.length; i < l; ++i) {
		const helper = entities[i];
		if (isFriendlyAyinHelperB1(entity, helper) && getEntityState(helper) === EntityState.Idle) {
			sumDx += (isOffensive ? enemy : entity).x - helper.x;
			sumDy += (isOffensive ? enemy : entity).y - helper.y;
			++helperCount;
		}
	}
	angle = safeAtan2(safeDiv(sumDy, helperCount), safeDiv(sumDx, helperCount));
	for (let i = 0, l = entities.length; i < l; ++i) {
		const helper = entities[i];
		if (isFriendlyAyinHelperB1(entity, helper) && getEntityState(helper) === EntityState.Idle) {
			helper.angleInt = angle;
			helper.preWarpVx = helper.preWarpVy = 0;
			helper.vx = safeCosMul(AYIN_HELPER_B1_WARP_SPEED, helper.angleInt);
			helper.vy = safeSinMul(AYIN_HELPER_B1_WARP_SPEED, helper.angleInt);
			setAyinCollisionSideFromBatt(entities[i]);
			setEntityState(helper, EntityState.Warp, AYIN_HELPER_B1_WARP_ACTIVE_FRAMES);
		}
	}
	setEntityState(entity, EntityState.Recovery, AYIN_HELPER_B1_WARP_RECOVERY_FRAMES);
}

export function handleAyinHelperB1State(entity_i: number, entities: Entity[], renderables: Renderable[]) {
	const entity = entities[entity_i];
	const enemy = getCollisionSidePossiblyFromBatt(entity) === CollisionSide.PlayerOne ? entities[PLAYER2_INDEX] : entities[PLAYER1_INDEX];
	const state = getEntityState(entity);
	if (state !== EntityState.Idle && --entity.framesToStateChange <= 0) {
		switch (state) {
			case EntityState.Moving:
				entity.vx = entity.vy = 0;
				setEntityState(entity, EntityState.Startup, AYIN_HELPER_B1_ATTACK_STARTUP_FRAMES);
				break;
			case EntityState.Startup:
				setEntityState(entity, EntityState.Active, AYIN_HELPER_B1_ATTACK_SHOT_COUNT * AYIN_HELPER_B1_ATTACK_SHOT_INTERVAL + 1);
				break;
			case EntityState.Active:
				let helperCount = 0;
				for (let i = 0, l = entities.length; i < l; ++i)
					if (isFriendlyAyinHelperB1(entity, entities[i]))
						++helperCount;
				if (helperCount > AYIN_HELPER_B1_MAX_COUNT) {
					entity.shouldBeRemoved = true;
				}else {
					setEntityState(entity, EntityState.Idle, 0);
					entity.vx = entity.vy = 0;
					setBattFromAyinCollisionSide(entity);
				}
				break;
			case EntityState.Warp:
				setEntityState(entity, EntityState.Idle, 0);
				setBattFromAyinCollisionSide(entity);
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
		} else if (state === EntityState.Warp) {
			renderEntityWarp(entity, renderables);
		} else if (state === EntityState.Idle || state === EntityState.Startup) {
			entity.angleInt = safeAtan2(enemy.y - entity.y, enemy.x - entity.x);
			entity.vx = entity.vy = 0;
		}
	}
}

export function handleAyinHelperB2State(entity_i: number, entities: Entity[]) {
	const entity = entities[entity_i];
	const currentFrame = AYIN_HELPER_B2_ACTIVE_FRAMES - entity.framesToStateChange;
	if (currentFrame < AYIN_HELPER_B2_LAUNCH_FRAMES) {
		// Do nothing
	} else {
		const owner = entity.collisionSide === CollisionSide.PlayerOne ? entities[PLAYER1_INDEX] : entities[PLAYER2_INDEX];
		entity.angleInt = safeAtan2(owner.y - entity.y, owner.x - entity.x);
		const currentSlowdownFrame = min(currentFrame - AYIN_HELPER_B2_LAUNCH_FRAMES, AYIN_HELPER_B2_SLOWDOWN_FRAMES);
		const maxSpeed = safeDiv(
			AYIN_HELPER_B2_RETURN_SPEED * currentSlowdownFrame +
				AYIN_HELPER_B2_LAUNCH_SPEED * (AYIN_HELPER_B2_SLOWDOWN_FRAMES - currentSlowdownFrame),
			AYIN_HELPER_B2_SLOWDOWN_FRAMES);
		doEntityAccel(entity, AYIN_HELPER_B2_RETURN_ACCEL, maxSpeed);
	}
	if (--entity.framesToStateChange <= 0)
		entity.shouldBeRemoved = true;
}

function tryStartupAyinB2(entity_i: number, entities: Entity[], move: Move, info: MoveInfo) {
	if (isUsingMove(getEntityState(entities[entity_i])) && entities[entity_i].startupMove === Move.B2) 
		return false; // Can't use this to explode earlier as a close-range attack
	
	for (let i = 0, l = entities.length; i < l; ++i) {
		if (entities[i].type === EntityType.AyinHelperB2 &&
			entities[i].collisionSide === (entity_i === PLAYER1_INDEX ? CollisionSide.PlayerOne : CollisionSide.PlayerTwo))
		{
			for (let j = 0; j < AYIN_HELPER_B2_ATTACK_SHOT_COUNT; ++j) {
				entities[i].angleInt = safeDiv(MAX_INT_ANGLE * j, AYIN_HELPER_B2_ATTACK_SHOT_COUNT);
				console.log(entities[i].angleInt);
				activateShotWithoutRecovery(i, entities, EntityType.AyinHelperB2AttackShot,
											AYIN_HELPER_B2_ATTACK_SHOT_SPEED,
											AYIN_HELPER_B2_ATTACK_SHOT_ACTIVE_FRAMES,
											entities[i].color, AYIN_HELPER_B2_WIDTH * 2);
			}
			entities[i].shouldBeRemoved = true;
			return true;
		}
	}
	if (isUsingMove(getEntityState(entities[entity_i]))) // Cancelling is disabled when doing a new shot.
		return false;
	return tryStartupWeapon(entity_i, entities, move, info);
}
