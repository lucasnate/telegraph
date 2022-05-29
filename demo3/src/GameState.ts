// TODO: If Ayin is hit while doing eye warp, eye warp should stop.

// TODO: This file needs to have float protection

// TODO: thrust is 1, 0.8, 0, 0.9

import { SyncData, InputValues } from '../../src/types';
import { RingBuffer } from '../../src/util/RingBuffer';
import { safeDiv, safeSqrt, MAX_INT_ANGLE, safeCosMul, safeSinMul, safeAtan2, abs, angleDiff, normalizeAngle, min, max, rand, norm2sq } from './safeCalc';
import { abstractKeyUpMask, abstractKeyLeftMask, abstractKeyRightMask, abstractKeyDownMask, abstractKeyRedMask, abstractKeyBlueMask,
		 abstractKeyA1Mask, abstractKeyB1Mask, abstractKeyA2Mask, abstractKeyB2Mask,
		 abstractKeyC1Mask, abstractKeyC2Mask, abstractKeyWarpMask} from './Inputter';

import { KIDON_WIDTH, KIDON_HEIGHT, KIDON_SHOT_A1_WIDTH, KIDON_SHOT_A2_WIDTH, KIDON_TRIANGLES, KIDON_SHOT_A1_TRIANGLES, KIDON_SHOT_A2_TRIANGLES, KIDON_SHOT_B2_TRIANGLES, KIDON_SHOT_B1_TRIANGLES, KIDON_COARSE_RADIUS, KIDON_SHOT_A1_COARSE_RADIUS, KIDON_SHOT_A2_COARSE_RADIUS, KIDON_SHOT_B2_COARSE_RADIUS, KIDON_SHOT_B1_COARSE_RADIUS, KIDON_SHOT_C1_BIG_COARSE_RADIUS, KIDON_SHOT_C1_SMALL_COARSE_RADIUS, KIDON_SHOT_C1_BIG_TRIANGLES, KIDON_SHOT_C1_SMALL_TRIANGLES, KIDON_SHOT_C1_BIG_HEIGHT, KIDON_SHOT_C2_BIG_HEIGHT, KIDON_SHOT_C2_BIG_COARSE_RADIUS, KIDON_SHOT_C2_SMALL_COARSE_RADIUS, KIDON_SHOT_C2_BIG_TRIANGLES, KIDON_SHOT_C2_SMALL_TRIANGLES, AYIN_SHAPE, AYIN_COARSE_RADIUS, AYIN_SHOT_A1_COARSE_RADIUS, AYIN_SHOT_A1_TRIANGLES, AYIN_HELPER_B1_COARSE_RADIUS, AYIN_HELPER_B1_SHAPE, AYIN_HELPER_B1_ATTACK_SHOT_SHAPE, AYIN_SHOT_A2_TRIANGLES, AYIN_SHOT_C1_TRIANGLES, AYIN_SHOT_C2_TRIANGLES, AYIN_HELPER_B2_SHAPE, AYIN_HELPER_B2_ATTACK_SHOT_SHAPE } from './shipShapes';
import { Point, rotateAndScaleAndTranslate, ShapeInfo, ShapeInfoType, fineShapeCollision, getCoarseRadius } from './spatial';
import { assert } from '../../src/util/assert';
import { Move } from './Move';
import { MoveInfo } from './MoveInfo';
import { kidonInfo } from './kidon';
import { ayinInfo, handleAyinHelperB1State, handleAyinHelperB2State, AYIN_HELPER_B1_ATTACK_SHOT_ACCEL_ON_BLOCK, AYIN_HELPER_B1_ATTACK_SHOT_ACCEL_ON_HIT, AYIN_HELPER_B1_ATTACK_SHOT_BLOCKSTUN_FRAMES, AYIN_HELPER_B1_ATTACK_SHOT_HITSTUN_FRAMES, AYIN_HELPER_B1_ATTACK_SHOT_BLOCKED_DAMAGE, AYIN_HELPER_B1_ATTACK_SHOT_HIT_DAMAGE, AYIN_HELPER_B1_ATTACK_SHOT_ACTIVE_FRAMES, AYIN_HELPER_B1_ATTACK_SHOT_HOMING_FRAMES, AYIN_HELPER_B1_ATTACK_SHOT_TURN_PER_FRAME, AYIN_HELPER_B1_ATTACK_SHOT_SPEED, AYIN_SHOT_C1_ACCEL_ON_BLOCK, AYIN_SHOT_C1_ACCEL_ON_HIT, AYIN_SHOT_C1_BLOCKSTUN_FRAMES, AYIN_SHOT_C1_HITSTUN_FRAMES, AYIN_SHOT_C1_BLOCKED_DAMAGE, AYIN_SHOT_C1_HIT_DAMAGE, AYIN_SHOT_A1_BLOCKED_DAMAGE, AYIN_SHOT_A1_HIT_DAMAGE, AYIN_SHOT_C2_ACCEL_ON_BLOCK, AYIN_SHOT_C2_ACCEL_ON_HIT, AYIN_SHOT_C2_BLOCKSTUN_FRAMES, AYIN_SHOT_C2_HITSTUN_FRAMES, AYIN_SHOT_C2_BLOCKED_DAMAGE, AYIN_SHOT_C2_HIT_DAMAGE, AYIN_SHOT_C2_FADE_FRAMES, AYIN_HELPER_B2_ATTACK_SHOT_ACCEL_ON_BLOCK, AYIN_HELPER_B2_ATTACK_SHOT_ACCEL_ON_HIT, AYIN_HELPER_B2_ATTACK_SHOT_BLOCKSTUN_FRAMES, AYIN_HELPER_B2_ATTACK_SHOT_HITSTUN_FRAMES, AYIN_HELPER_B2_ATTACK_SHOT_BLOCKED_DAMAGE, AYIN_HELPER_B2_ATTACK_SHOT_HIT_DAMAGE, AYIN_HELPER_B2_ATTACK_SHOT_ACTIVE_FRAMES, AYIN_HELPER_B2_ATTACK_SHOT_HOMING_FRAMES, AYIN_HELPER_B2_ATTACK_SHOT_TURN_PER_FRAME, AYIN_HELPER_B2_ATTACK_SHOT_SPEED } from './ayin';
import { ShipInfo } from './ShipInfo';
import { shipInfos } from './shipInfos';
import { ActivationHandler } from './ActivationHandler';
import { EntityType, CollisionSide, EntityState, EntityColor, Entity } from './Entity';
import { KIDON_SHOT_A1_RECOVERY_FRAMES, KIDON_SHOT_A2_RECOVERY_FRAMES, KIDON_SHOT_B1_ACTIVE_FRAMES, KIDON_SHOT_B2_ACTIVE_FRAMES, KIDON_SHOT_C1_ACTIVE_FRAMES, KIDON_SHOT_A2_SPEED, KIDON_SHOT_A2_ACTIVE_FRAMES, KIDON_SHOT_C1_RECOVERY_FRAMES, KIDON_SHOT_C2_RECOVERY_FRAMES, KIDON_SHOT_A2_STARTUP_FRAMES, KIDON_SHOT_C1_STARTUP_FRAMES, KIDON_SHOT_C2_STARTUP_FRAMES, KIDON_SHOT_C2_BIG_ACTIVE_FRAMES, KIDON_SHOT_A1_ACTIVE_FRAMES, KIDON_SHOT_A1_SPEED, KIDON_SHOT_B2_RECOVERY_FRAMES, KIDON_SHOT_B1_RECOVERY_FRAMES } from './kidon';
import { AYIN_SHOT_A1_RECOVERY_FRAMES, AYIN_HELPER_B1_ATTACK_STARTUP_FRAMES, AYIN_SHOT_A2_BLOCKSTUN_FRAMES, AYIN_SHOT_A2_HITSTUN_FRAMES, AYIN_SHOT_A2_ACTIVE_FRAMES, AYIN_SHOT_A2_HOMING_FRAMES, AYIN_SHOT_A2_TURN_PER_FRAME, AYIN_SHOT_A2_SPEED } from './ayin';
import { getEntityState, setEntityState, disableShipWarp, PLAYER1_INDEX, PLAYER2_INDEX, turnToWantedAngle, SHIP_SET, SHIP_LIST, handleHomingShotState, doEntityAccel, renderEntityWarp, isUsingMove } from './gameUtil';
import { Renderable, RenderableType } from './Renderable';

shipInfos.set(EntityType.KidonShip, kidonInfo);
shipInfos.set(EntityType.AyinShip, ayinInfo);
for (let key of Array.from(shipInfos.keys())) {
	SHIP_LIST.push(key);
	SHIP_SET.add(key);
}
export const HELPER_LIST = [EntityType.AyinHelperB1, EntityType.AyinHelperB2];
export const SHIP_AND_HELPER_LIST = HELPER_LIST.concat(SHIP_LIST);

// TODO: Make vx/vy private so that they cannot be changed during warp.
// TODO: Most important before everything, a constant silent sound.
// TODO: Shift
// TODO: Weapon Shift-A
// TODO: At some point we should get rid of many of our maps and have a type representing the
//       entity type. Something like a prototype :)
// TODO: Add an assert that *_FRAMES are not negative.
// TODO: Allow controlling net connection params


// TODO: Need to get these things through syncData
export const WORLD_WIDTH = 100000;
export const WORLD_HEIGHT = 100000;
export const KIDON_FULL_TURN_FRAMES = 60;
export const KIDON_TURN_PER_FRAME = safeDiv(MAX_INT_ANGLE, KIDON_FULL_TURN_FRAMES);
export const KIDON_THRUST_COUNT = 3;
export const KIDON_THRUST_SPEED = kidonInfo.accel * 6;
export const KIDON_THRUST_SPEED_NOISE = kidonInfo.accel;
export const KIDON_THRUST_ANGLE_NOISE = safeDiv(MAX_INT_ANGLE, 5);
export const KIDON_THRUST_OFFSET_NOISE = safeDiv(KIDON_WIDTH, 10);
export const THRUST_FRAMES = 20;
export const KIDON_SHOT_A1_ADVANTAGE_ON_HIT = 13;
export const KIDON_SHOT_A1_ADVANTAGE_ON_BLOCK = -1;
export const KIDON_SHOT_A1_HITSTUN_FRAMES = KIDON_SHOT_A1_RECOVERY_FRAMES + KIDON_SHOT_A1_ADVANTAGE_ON_HIT;
assert(KIDON_SHOT_A1_HITSTUN_FRAMES >= 0, "Negative frames");
export const KIDON_SHOT_A1_BLOCKSTUN_FRAMES = KIDON_SHOT_A1_RECOVERY_FRAMES + KIDON_SHOT_A1_ADVANTAGE_ON_BLOCK;
assert(KIDON_SHOT_A1_BLOCKSTUN_FRAMES >= 0, "Negative frames");
export const KIDON_SHOT_A1_HOMING_FRAMES = 6;
export const KIDON_SHOT_A1_TOTAL_TURN = safeDiv(MAX_INT_ANGLE, 8);
export const KIDON_SHOT_A1_TURN_PER_FRAME = safeDiv(KIDON_SHOT_A1_TOTAL_TURN, KIDON_SHOT_A1_HOMING_FRAMES);
export const KIDON_SHOT_A1_ACCEL_ON_HIT = safeDiv(kidonInfo.maxSpeed, 4);
export const KIDON_SHOT_A1_ACCEL_ON_BLOCK = safeDiv(kidonInfo.maxSpeed, 8);
export const KIDON_SHOT_A1_BLOCKED_DAMAGE = 30;
export const KIDON_SHOT_A1_HIT_DAMAGE = 300;

export const KIDON_SHOT_B2_ACCEL_ON_HIT = safeDiv(kidonInfo.maxSpeed, 8);
export const KIDON_SHOT_B2_ACCEL_ON_BLOCK = safeDiv(kidonInfo.maxSpeed, 16);
export const KIDON_SHOT_B2_ADVANTAGE_ON_HIT = 18;
export const KIDON_SHOT_B2_ADVANTAGE_ON_BLOCK = -10;
export const KIDON_SHOT_B2_HITSTUN_FRAMES = KIDON_SHOT_B2_ACTIVE_FRAMES + KIDON_SHOT_B2_RECOVERY_FRAMES + KIDON_SHOT_B2_ADVANTAGE_ON_HIT;
assert(KIDON_SHOT_B2_HITSTUN_FRAMES >= 0, "Negative frames");
export const KIDON_SHOT_B2_BLOCKSTUN_FRAMES = KIDON_SHOT_B2_ACTIVE_FRAMES + KIDON_SHOT_B2_RECOVERY_FRAMES + KIDON_SHOT_B2_ADVANTAGE_ON_BLOCK;
assert(KIDON_SHOT_B2_BLOCKSTUN_FRAMES >= 0, "Negative frames");
export const KIDON_SHOT_B2_BLOCKED_DAMAGE = 90;
export const KIDON_SHOT_B2_HIT_DAMAGE = 900;
export const KIDON_SHOT_B2_FADE_FRAMES = 12;

export const KIDON_SHOT_B1_ACCEL_ON_HIT = safeDiv(kidonInfo.maxSpeed * 3, 2);
export const KIDON_SHOT_B1_ACCEL_ON_BLOCK = safeDiv(kidonInfo.maxSpeed, 16);
export const KIDON_SHOT_B1_ADVANTAGE_ON_HIT = 12;
export const KIDON_SHOT_B1_ADVANTAGE_ON_BLOCK = 0;
export const KIDON_SHOT_B1_HITSTUN_FRAMES = KIDON_SHOT_B1_ACTIVE_FRAMES + KIDON_SHOT_B1_RECOVERY_FRAMES + KIDON_SHOT_B1_ADVANTAGE_ON_HIT;
assert(KIDON_SHOT_B1_HITSTUN_FRAMES >= 0, "Negative frames");
export const KIDON_SHOT_B1_BLOCKSTUN_FRAMES = KIDON_SHOT_B1_ACTIVE_FRAMES + KIDON_SHOT_B1_RECOVERY_FRAMES + KIDON_SHOT_B1_ADVANTAGE_ON_BLOCK;
assert(KIDON_SHOT_B1_BLOCKSTUN_FRAMES >= 0, "Negative frames");
export const KIDON_SHOT_B1_BLOCKED_DAMAGE = 90;
export const KIDON_SHOT_B1_HIT_DAMAGE = 900;
export const KIDON_SHOT_B1_FADE_FRAMES = 12;

export const KIDON_SHOT_A2_ADVANTAGE_ON_HIT = 13;
export const KIDON_SHOT_A2_ADVANTAGE_ON_BLOCK = -1;
export const KIDON_SHOT_A2_HITSTUN_FRAMES = KIDON_SHOT_A2_RECOVERY_FRAMES + KIDON_SHOT_A2_ADVANTAGE_ON_HIT;
assert(KIDON_SHOT_A2_HITSTUN_FRAMES >= 0, "Negative frames");
export const KIDON_SHOT_A2_BLOCKSTUN_FRAMES = KIDON_SHOT_A2_RECOVERY_FRAMES + KIDON_SHOT_A2_ADVANTAGE_ON_BLOCK;
assert(KIDON_SHOT_A2_BLOCKSTUN_FRAMES >= 0, "Negative frames");
export const KIDON_SHOT_A2_HOMING_FRAMES = KIDON_SHOT_A2_ACTIVE_FRAMES;
export const KIDON_SHOT_A2_TOTAL_TURN = MAX_INT_ANGLE;
export const KIDON_SHOT_A2_TURN_PER_FRAME = safeDiv(KIDON_SHOT_A2_TOTAL_TURN, KIDON_SHOT_A2_HOMING_FRAMES);
export const KIDON_SHOT_A2_ACCEL_ON_HIT = safeDiv(kidonInfo.maxSpeed, 4);
export const KIDON_SHOT_A2_ACCEL_ON_BLOCK = safeDiv(kidonInfo.maxSpeed, 8);
export const KIDON_SHOT_A2_BLOCKED_DAMAGE = 30;
export const KIDON_SHOT_A2_HIT_DAMAGE = 300;


export const KIDON_SHOT_C1_BIG_ACCEL_ON_HIT = safeDiv(kidonInfo.maxSpeed, 4);
export const KIDON_SHOT_C1_BIG_ACCEL_ON_BLOCK = safeDiv(kidonInfo.maxSpeed, 8);
export const KIDON_SHOT_C1_BIG_ADVANTAGE_ON_HIT = 13;
export const KIDON_SHOT_C1_BIG_ADVANTAGE_ON_BLOCK = -8;
export const KIDON_SHOT_C1_BIG_BLOCKSTUN_FRAMES = KIDON_SHOT_C1_RECOVERY_FRAMES + KIDON_SHOT_C1_BIG_ADVANTAGE_ON_BLOCK;
export const KIDON_SHOT_C1_BIG_HITSTUN_FRAMES = KIDON_SHOT_C1_RECOVERY_FRAMES + KIDON_SHOT_C1_BIG_ADVANTAGE_ON_HIT;
export const KIDON_SHOT_C1_BIG_BLOCKED_DAMAGE = 150;
export const KIDON_SHOT_C1_BIG_HIT_DAMAGE = 1500;


export const KIDON_SHOT_C1_SMALL_ACCEL_ON_HIT = safeDiv(kidonInfo.maxSpeed, 4);
export const KIDON_SHOT_C1_SMALL_ACCEL_ON_BLOCK = safeDiv(kidonInfo.maxSpeed, 8);
export const KIDON_SHOT_C1_SMALL_ADVANTAGE_ON_HIT = 8;
export const KIDON_SHOT_C1_SMALL_ADVANTAGE_ON_BLOCK = -10;
export const KIDON_SHOT_C1_SMALL_BLOCKSTUN_FRAMES = KIDON_SHOT_C1_RECOVERY_FRAMES + KIDON_SHOT_C1_SMALL_ADVANTAGE_ON_BLOCK;
export const KIDON_SHOT_C1_SMALL_HITSTUN_FRAMES = KIDON_SHOT_C1_RECOVERY_FRAMES + KIDON_SHOT_C1_SMALL_ADVANTAGE_ON_HIT;
export const KIDON_SHOT_C1_SMALL_BLOCKED_DAMAGE = 60;
export const KIDON_SHOT_C1_SMALL_HIT_DAMAGE = 600;

export const KIDON_SHOT_C1_SPAWN_INTERVAL_FRAMES = 12;
export const KIDON_SHOT_C1_SPREAD_SPEED = safeDiv(KIDON_SHOT_C1_BIG_HEIGHT, 40);

export const KIDON_SHOT_C2_BIG_ACCEL_ON_HIT = safeDiv(kidonInfo.maxSpeed, 3);
export const KIDON_SHOT_C2_BIG_ACCEL_ON_BLOCK = safeDiv(kidonInfo.maxSpeed, 6);
export const KIDON_SHOT_C2_BIG_ADVANTAGE_ON_HIT = 13;
export const KIDON_SHOT_C2_BIG_ADVANTAGE_ON_BLOCK = -8;
export const KIDON_SHOT_C2_BIG_BLOCKSTUN_FRAMES = KIDON_SHOT_C2_RECOVERY_FRAMES + KIDON_SHOT_C2_BIG_ADVANTAGE_ON_BLOCK;
export const KIDON_SHOT_C2_BIG_HITSTUN_FRAMES = KIDON_SHOT_C2_RECOVERY_FRAMES + KIDON_SHOT_C2_BIG_ADVANTAGE_ON_HIT;
export const KIDON_SHOT_C2_BIG_BLOCKED_DAMAGE = 150;
export const KIDON_SHOT_C2_BIG_HIT_DAMAGE = 1500;

export const KIDON_SHOT_C2_SMALL_RANGE = KIDON_WIDTH;
export const KIDON_SHOT_C2_SMALL_SPEED = safeDiv(kidonInfo.maxSpeed, 5);
export const KIDON_SHOT_C2_SMALL_ACTIVE_FRAMES = safeDiv(KIDON_SHOT_C2_SMALL_RANGE, KIDON_SHOT_C2_SMALL_SPEED);
export const KIDON_SHOT_C2_SMALL_ACCEL_ON_HIT = safeDiv(kidonInfo.maxSpeed, 24);
export const KIDON_SHOT_C2_SMALL_ACCEL_ON_BLOCK = safeDiv(kidonInfo.maxSpeed, 48);
export const KIDON_SHOT_C2_SMALL_ADVANTAGE_ON_HIT = 8;
export const KIDON_SHOT_C2_SMALL_ADVANTAGE_ON_BLOCK = -10;
export const KIDON_SHOT_C2_SMALL_BLOCKSTUN_FRAMES = KIDON_SHOT_C2_RECOVERY_FRAMES + KIDON_SHOT_C2_SMALL_ADVANTAGE_ON_BLOCK;
export const KIDON_SHOT_C2_SMALL_HITSTUN_FRAMES = KIDON_SHOT_C2_RECOVERY_FRAMES + KIDON_SHOT_C2_SMALL_ADVANTAGE_ON_HIT;
export const KIDON_SHOT_C2_SMALL_BLOCKED_DAMAGE = 60;
export const KIDON_SHOT_C2_SMALL_HIT_DAMAGE = 600;

export const KIDON_SHOT_C2_SPAWN_INTERVAL_FRAMES = 12;

export const AYIN_SHOT_A1_ACCEL_ON_BLOCK = KIDON_SHOT_A1_ACCEL_ON_BLOCK * 7;
export const AYIN_SHOT_A1_ACCEL_ON_HIT = KIDON_SHOT_A1_ACCEL_ON_HIT * 7;
export const AYIN_SHOT_A1_ADVANTAGE_ON_HIT = 25;
export const AYIN_SHOT_A1_ADVANTAGE_ON_BLOCK = -5;
export const AYIN_SHOT_A1_HITSTUN_FRAMES = AYIN_SHOT_A1_RECOVERY_FRAMES + AYIN_SHOT_A1_ADVANTAGE_ON_HIT;
assert(AYIN_SHOT_A1_HITSTUN_FRAMES >= 0, "Negative frames");
export const AYIN_SHOT_A1_BLOCKSTUN_FRAMES = AYIN_SHOT_A1_RECOVERY_FRAMES + AYIN_SHOT_A1_ADVANTAGE_ON_BLOCK;
assert(AYIN_SHOT_A1_BLOCKSTUN_FRAMES >= 0, "Negative frames");
export const AYIN_SHOT_A1_FADE_FRAMES = 20;


export const MIN_EXPLOSION_PARTICLE_COUNT = 4;
export const MAX_EXPLOSION_PARTICLE_COUNT = 24;
export const MIN_EXPLOSION_PARTICLE_SPEED = safeDiv(kidonInfo.maxSpeed, 2);
export const MAX_EXPLOSION_PARTICLE_SPEED = safeDiv(kidonInfo.maxSpeed, 4);
export const MIN_EXPLOSION_PARTICLE_FRAMES = 10;
export const MAX_EXPLOSION_PARTICLE_FRAMES = 50;
export const MIN_EXPLOSION_PARTICLE_SIZE_PCT = 50;
export const MIN_EXPLOSION_PARTICLE_SIZE_MUL_STEP = 2;
export const MAX_EXPLOSION_PARTICLE_SIZE_PCT = 200;
export const DAMAGE_PER_SMALLEST_PARTICLE = safeDiv(KIDON_SHOT_A1_BLOCKED_DAMAGE, MIN_EXPLOSION_PARTICLE_COUNT);

const WALL_DAMAGE = 100;

const WIN_SCREEN_FRAMES = 300;


export const AYIN_MAX_HP = 10000;


const PLAYER1_START_X = -safeDiv(WORLD_WIDTH, 6);
const PLAYER1_START_Y = -safeDiv(WORLD_HEIGHT, 6);
const PLAYER2_START_X = +safeDiv(WORLD_WIDTH, 6);
const PLAYER2_START_Y = +safeDiv(WORLD_HEIGHT, 6);
export const MIN_X = -safeDiv(WORLD_WIDTH, 2);
export const MAX_X = +safeDiv(WORLD_WIDTH, 2);
export const MIN_Y = -safeDiv(WORLD_HEIGHT, 2);
export const MAX_Y = +safeDiv(WORLD_HEIGHT, 2);

const FRAMES_TO_IDLE_AFTER_UP = 1;

export interface GameSyncData extends SyncData {}



export enum WinScreen {
	None,
	Player1,
	Player2,
	Draw
}


export interface GameState {
	entities: Entity[],
	renderables: Renderable[],
	player1InputHistory: number[],
	player1InputHistoryNextIndex: number,
	player2InputHistory: number[],
	player2InputHistoryNextIndex: number,
	player1CurrentComboHits: number,
	player2CurrentComboHits: number,
	winScreen: WinScreen,
	winScreenRemainingFrames: number
	mulberryState: number
}

type MoveInputChecker = { (move: Move, input: number, inputHistory: number[], inputHistoryNextIndex: number): boolean; }

function isDoingA1(move: Move, input: number, inputHistory: number[], inputHistoryNextIndex: number): boolean {
	const lastInput = getLastInput(inputHistory, inputHistoryNextIndex);
	return (input & abstractKeyA1Mask) && !(lastInput & abstractKeyA1Mask) ? true : false;
}

function isDoingA2(move: Move, input: number, inputHistory: number[], inputHistoryNextIndex: number): boolean {
	const lastInput = getLastInput(inputHistory, inputHistoryNextIndex);
	return (input & abstractKeyA2Mask) && !(lastInput & abstractKeyA2Mask) ? true : false;
}

function isDoingB1(move: Move, input: number, inputHistory: number[], inputHistoryNextIndex: number): boolean {
	const lastInput = getLastInput(inputHistory, inputHistoryNextIndex);
	return (input & abstractKeyB1Mask) && !(lastInput & abstractKeyB1Mask) ? true : false;
}

function isDoingB2(move: Move, input: number, inputHistory: number[], inputHistoryNextIndex: number): boolean {
	const lastInput = getLastInput(inputHistory, inputHistoryNextIndex);
	return (input & abstractKeyB2Mask) && !(lastInput & abstractKeyB2Mask) ? true : false;
}

function isDoingC1(move: Move, input: number, inputHistory: number[], inputHistoryNextIndex: number): boolean {
	const lastInput = getLastInput(inputHistory, inputHistoryNextIndex);
	return (input & abstractKeyC1Mask) && !(lastInput & abstractKeyC1Mask) ? true : false;
}

function isDoingC2(move: Move, input: number, inputHistory: number[], inputHistoryNextIndex: number): boolean {
	const lastInput = getLastInput(inputHistory, inputHistoryNextIndex);
	return (input & abstractKeyC2Mask) && !(lastInput & abstractKeyC2Mask) ? true : false;
}

function isDoingWarpWithKey(keyMask: number, input: number, inputHistory: number[], inputHistoryNextIndex: number): boolean {
	const lastInput = getLastInput(inputHistory, inputHistoryNextIndex);
	// if (input & abstractKeyWarpMask) {
	// 	console.log("DEBUGBUG: " +
	// 		(!!(input & keyMask)).toString() +
	// 		(!!(input & abstractKeyWarpMask)).toString() +
	// 		(!!(lastInput & keyMask)).toString() +
	// 		(!!(lastInput & abstractKeyWarpMask)).toString() +
	// 		(!((lastInput & keyMask) && (lastInput && abstractKeyWarpMask))).toString());
	// }
	return ((input & keyMask) && (input & abstractKeyWarpMask) &&
		!((lastInput & keyMask) && (lastInput & abstractKeyWarpMask))) ? true : false;
}

function isDoingWarpUp(move: Move, input: number, inputHistory: number[], inputHistoryNextIndex: number): boolean {
	return isDoingWarpWithKey(abstractKeyUpMask, input, inputHistory, inputHistoryNextIndex);
}

function isDoingWarpLeft(move: Move, input: number, inputHistory: number[], inputHistoryNextIndex: number): boolean {
	return isDoingWarpWithKey(abstractKeyLeftMask, input, inputHistory, inputHistoryNextIndex);
}

function isDoingWarpRight(move: Move, input: number, inputHistory: number[], inputHistoryNextIndex: number): boolean {
	return isDoingWarpWithKey(abstractKeyRightMask, input, inputHistory, inputHistoryNextIndex);
}

function isDoingWarpDown(move: Move, input: number, inputHistory: number[], inputHistoryNextIndex: number): boolean {
	return isDoingWarpWithKey(abstractKeyDownMask, input, inputHistory, inputHistoryNextIndex);
}

// TODO: Where should I put this function?
export function assertDefinedForAllEnumExcept(map: Map<any, any>, en: any, except: Set<number>) {
	for (const value1 in en) {
		const value1Num = Number(value1);
		if (isNaN(value1Num)) continue;
		if (map.get(value1Num) == null && !except.has(value1Num))
			throw new Error("Missing value in map: " + value1);
	}
}

export function assertDefinedForAllEnum(map: Map<any, any>, en: any) {
	return assertDefinedForAllEnumExcept(map, en, new Set<number>());
}

const MOVE_INPUT_CHECKERS = new Map<Move, MoveInputChecker>(
	[[Move.A1, isDoingA1],
	 [Move.B2, isDoingB2],
	 [Move.B1, isDoingB1],
	 [Move.A2, isDoingA2],
	 [Move.C1, isDoingC1],
	 [Move.C2, isDoingC2],
	 [Move.WarpUp, isDoingWarpUp],
	 [Move.WarpDown, isDoingWarpDown],
	 [Move.WarpLeft, isDoingWarpLeft],
	 [Move.WarpRight, isDoingWarpRight]]);
assertDefinedForAllEnum(MOVE_INPUT_CHECKERS, Move);

function getLastInput(inputHistory: number[], inputHistoryNextIndex: number) {
	return inputHistory[inputHistoryNextIndex - 1 < 0 ? (inputHistory.length - 1) : inputHistoryNextIndex - 1];
}


const AVAILABLE_MOVES = [Move.C2, Move.C1, Move.B2, Move.B1, Move.A2, Move.A1, Move.WarpUp, Move.WarpDown, Move.WarpLeft, Move.WarpRight];
function tryStartupAnyMove(entity_i: number, entities: Entity[], input: number, inputHistory: number[], inputHistoryNextIndex: number) {
	const entity = entities[entity_i];
	for (var i = 0, l = AVAILABLE_MOVES.length; i < l; ++i) {
		const move = AVAILABLE_MOVES[i];
		const inputChecker = MOVE_INPUT_CHECKERS.get(move)!;
		if (inputChecker(move, input, inputHistory, inputHistoryNextIndex)) {
			const info = shipInfos.get(entity.type)!.moveInfo.get(move)!;
			if (info == null)
				continue;

			if (!info.canCancel && isUsingMove(getEntityState(entity)))
				continue;
			
			if (info.onTryStartup(entity_i, entities, move, info))
				return;
		}
	}
}

function handleEntityKeyboard(entity_i: number, gameState: GameState, input: number, inputHistory: number[], inputHistoryNextIndex: number) {
	const entities = gameState.entities;
	const renderables = gameState.renderables;
	const entity = entities[entity_i];
	let state = getEntityState(entity);
	const enemy = entities[entity_i === PLAYER1_INDEX ? PLAYER2_INDEX : PLAYER1_INDEX];
	const stun = state === EntityState.Hitstun || state === EntityState.Blockstun;
	const usingMove = isUsingMove(getEntityState(entity));
	const lastInput = getLastInput(inputHistory, inputHistoryNextIndex);
	const shipInfo = shipInfos.get(entity.type)!;
	assert(shipInfo != null, "null shipInfo in handleEntityKeyboard");
		
	if (!stun) {
		tryStartupAnyMove(entity_i, entities, input, inputHistory, inputHistoryNextIndex);
		state = getEntityState(entity);
	}

	if ((input & abstractKeyUpMask) && !(input & abstractKeyWarpMask) && !stun &&
		(state !== EntityState.Warp || !(lastInput & abstractKeyUpMask))) {
		doEntityAccel(entity, shipInfo.accel, shipInfo.maxSpeed);
		
		if (state === EntityState.Idle || state === EntityState.Moving || state === EntityState.Warp) {
			// TODO: If we merge handleEntityKeyboard with handleEntityState, might need to get rid of this +1.
			setEntityState(entity, EntityState.Moving, FRAMES_TO_IDLE_AFTER_UP + 1);
		}

		const oppositeAngle = entity.angleInt + safeDiv(MAX_INT_ANGLE, 2);
		const orthogonalAngle = entity.angleInt + safeDiv(MAX_INT_ANGLE, 4);
		for (let i = 0; i < KIDON_THRUST_COUNT; ++i) {
			const speedNoise = rand(gameState, -KIDON_THRUST_SPEED_NOISE, +KIDON_THRUST_SPEED_NOISE);
			const angleNoise = rand(gameState, -KIDON_THRUST_ANGLE_NOISE, +KIDON_THRUST_ANGLE_NOISE);
			const offsetNoise = rand(gameState, -KIDON_THRUST_OFFSET_NOISE, +KIDON_THRUST_OFFSET_NOISE);
			const renderable = {
				type: RenderableType.ThrustParticle,
				x: entity.x + safeCosMul(safeDiv(KIDON_HEIGHT, 2), oppositeAngle) + safeCosMul(offsetNoise, orthogonalAngle),
				y: entity.y + safeSinMul(safeDiv(KIDON_HEIGHT, 2), oppositeAngle) + safeSinMul(offsetNoise, orthogonalAngle),
				angleInt: 0,
				vx: safeCosMul(KIDON_THRUST_SPEED + speedNoise, oppositeAngle + angleNoise),
				vy: safeSinMul(KIDON_THRUST_SPEED + speedNoise, oppositeAngle + angleNoise),
				ax: 0,
				ay: 0,
				remainingFrames: THRUST_FRAMES,
				totalFrames: THRUST_FRAMES,
				sizePct: 100,
			};
			renderables.push(renderable);
		}
	} else if ((input & abstractKeyDownMask) && !(input & abstractKeyWarpMask) && !stun) {
		let norm2 = norm2sq(entity.vx, entity.vy);
		if (norm2 < shipInfo.accel * shipInfo.accel) {
			entity.vx = 0;
			entity.vy = 0;
		} else {
			const angleInt = safeAtan2(entity.vy, entity.vx);
			entity.vx -= safeCosMul(shipInfo.accel, angleInt);
			entity.vy -= safeSinMul(shipInfo.accel, angleInt);
		}
		
	}

	if ((input & abstractKeyLeftMask) && !(input & abstractKeyWarpMask) && state !== EntityState.Active && state !== EntityState.Warp) {
		entity.angleInt = normalizeAngle(entity.angleInt + KIDON_TURN_PER_FRAME);
	}
	if ((input & abstractKeyRightMask) && !(input & abstractKeyWarpMask) && state !== EntityState.Active && state !== EntityState.Warp) {
		entity.angleInt = normalizeAngle(entity.angleInt - KIDON_TURN_PER_FRAME);
	}
		
	if ((input & abstractKeyBlueMask) && !usingMove) {
		entity.color = EntityColor.Blue;
	}

	if ((input & abstractKeyRedMask) && !usingMove) {
		entity.color = EntityColor.Red;
	}

}

function handleShipState(entity_i: number, gameState: GameState) {
	const entities = gameState.entities;
	const renderables = gameState.renderables;
	const entity = entities[entity_i];
	const state = getEntityState(entity);
	const shipInfo = shipInfos.get(entity.type)!;
	assert(shipInfo != null, "handleShipState called on non-ship");
	
	
	if (state !== EntityState.Hitstun && state !== EntityState.Warp) {
		if (entity.noStablizeFrames > 0)
			--entity.noStablizeFrames;
		else {
			const normSq = norm2sq(entity.vx, entity.vy);
			const allowedSpeed = state === EntityState.Moving ? shipInfo.maxSpeed : shipInfo.maxSpeedWithoutUp;
			if (normSq > allowedSpeed * allowedSpeed) {
				const norm = safeSqrt(normSq);
				const newNorm = max(norm - shipInfo.stablizeAccel, allowedSpeed);
				entity.vx = safeDiv(entity.vx * newNorm, norm);
				entity.vy = safeDiv(entity.vy * newNorm, norm);
			}
		}
	}

	switch (state) {
		case EntityState.Idle:
			break;
		case EntityState.Recovery:
		case EntityState.Moving:
		case EntityState.Hitstun:
		case EntityState.Blockstun:
			if (--entity.framesToStateChange <= 0)
				setEntityState(entity, EntityState.Idle, 0);
			break;
		case EntityState.Startup:
			if (--entity.framesToStateChange <= 0) {
				shipInfo.moveInfo.get(entity.startupMove!)!.onActivation(entity_i, entities);
			}
			break;
		case EntityState.Active:
			if (--entity.framesToStateChange <= 0) {
				assert(entity.startupMove != null, "missing startup move when active");
				const framesToStateChange = shipInfo.moveInfo.get(entity.startupMove!)!.recoveryFrames;
				assert(framesToStateChange != null, "missing recovery frames for " + (entity.startupMove != null ? entity.startupMove.toString() : null));
				setEntityState(entity, EntityState.Recovery,framesToStateChange!);
			}
			break;
		case EntityState.Warp:
			renderEntityWarp(entity, renderables);
			if (--entity.framesToStateChange <= 0) {
				disableShipWarp(entity);
			}
			break;
		default:
			throw new Error("Unsupported state");
	}
	++entity.batt;
	if (entity.batt > shipInfo.maxBatt)
		entity.batt = shipInfo.maxBatt;
	++entity.warp;
	if (entity.warp > shipInfo.maxWarp)
		entity.warp = shipInfo.maxWarp;
}

// TODO: Can we merge handleEntityState with handleEntityMovement?
function handleEntityState(entity_i: number, gameState: GameState) {
	const entities = gameState.entities;
	const renderables = gameState.renderables;
	const entity = entities[entity_i];
	const state = getEntityState(entity);
	switch (entity.type) {
		case EntityType.KidonShip:
		case EntityType.AyinShip:
			handleShipState(entity_i, gameState);
			break;
		case EntityType.KidonShotC1Big:
			if (entity.framesToStateChange !== KIDON_SHOT_C1_ACTIVE_FRAMES &&
				(KIDON_SHOT_C1_ACTIVE_FRAMES - entity.framesToStateChange) % KIDON_SHOT_C1_SPAWN_INTERVAL_FRAMES === 0) {
				for (let i = -1; i <= +1; i += 2) {
					const spreadAngle = entity.angleInt + i * safeDiv(MAX_INT_ANGLE, 4);
					const newEntity = {type: EntityType.KidonShotC1Small,
									   hp: 1, // TODO: Is this the right thing to put here?
									   batt: 1, // TODO: Is this the right thing to put here?
									   warp: 1, // TODO: Is this the right thing to put here?
									   x: entity.x + safeCosMul(safeDiv(KIDON_SHOT_C1_BIG_HEIGHT, 2), spreadAngle),
									   y: entity.y + safeSinMul(safeDiv(KIDON_SHOT_C1_BIG_HEIGHT, 2), spreadAngle),
									   vx: entity.vx + safeCosMul(KIDON_SHOT_C1_SPREAD_SPEED, spreadAngle),
									   vy: entity.vy + safeSinMul(KIDON_SHOT_C1_SPREAD_SPEED, spreadAngle),
									   preWarpVx: 0,
									   preWarpVy: 0,									   
									   angleInt: entity.angleInt,
									   scaleWidthPct: 100,
									   scaleHeightPct: 100,
									   collisionSide: entity.collisionSide,
									   framesToStateChange: entity.framesToStateChange,
									   noStablizeFrames: 0,
									   stateDoNotTouchDirectly: EntityState.Moving,
									   startupMove: null,
									   color: entity.color,
									   shouldBeRemoved: false};
					entities.push(newEntity);
				}
			}
			if (--entity.framesToStateChange <= 0)
				entity.shouldBeRemoved = true;
			break;
		case EntityType.KidonShotC2Big:
			if (entity.framesToStateChange !== KIDON_SHOT_C2_BIG_ACTIVE_FRAMES &&
				(KIDON_SHOT_C2_BIG_ACTIVE_FRAMES - entity.framesToStateChange) % KIDON_SHOT_C2_SPAWN_INTERVAL_FRAMES === 0) {
				for (let i = -1; i <= +1; i += 2) {
					const spreadAngle = entity.angleInt + i * safeDiv(MAX_INT_ANGLE, 4);
					const newEntity = {type: EntityType.KidonShotC2Small,
									   hp: 1, // TODO: Is this the right thing to put here?
									   batt: 1, // TODO: Is this the right thing to put here?
									   warp: 1, // TODO: Is this the right thing to put here?
									   x: entity.x + safeCosMul(safeDiv(KIDON_SHOT_C2_BIG_HEIGHT, 2), spreadAngle),
									   y: entity.y + safeSinMul(safeDiv(KIDON_SHOT_C2_BIG_HEIGHT, 2), spreadAngle),
									   vx: safeCosMul(KIDON_SHOT_C2_SMALL_SPEED, spreadAngle),
									   vy: safeSinMul(KIDON_SHOT_C2_SMALL_SPEED, spreadAngle),
									   preWarpVx: 0,
									   preWarpVy: 0,									   
									   angleInt: spreadAngle,
									   scaleWidthPct: 100,
									   scaleHeightPct: 100,
									   collisionSide: entity.collisionSide,
									   framesToStateChange: KIDON_SHOT_C2_SMALL_ACTIVE_FRAMES,
									   noStablizeFrames: 0,
									   stateDoNotTouchDirectly: EntityState.Moving,
									   startupMove: null,
									   color: entity.color,
									   shouldBeRemoved: false};
					entities.push(newEntity);
				}
			}
			if (--entity.framesToStateChange <= 0)
				entity.shouldBeRemoved = true;
			break;
		case EntityType.KidonShotB1:
		case EntityType.KidonShotB2:
		case EntityType.AyinShotA1:
		case EntityType.AyinShotC2:
			if (--entity.framesToStateChange <= 0) {
				if (entity.collisionSide !== CollisionSide.None) {
					entity.collisionSide = CollisionSide.None;
					entity.framesToStateChange = getFadeFrames(entity.type);
				} else {
					entity.shouldBeRemoved = true;
				}
			}
			break;
		case EntityType.KidonShotA1:
			handleHomingShotState(entity_i, entities, KIDON_SHOT_A1_ACTIVE_FRAMES, KIDON_SHOT_A1_HOMING_FRAMES, KIDON_SHOT_A1_TURN_PER_FRAME, KIDON_SHOT_A1_SPEED);
			break;			
		case EntityType.KidonShotA2:
			handleHomingShotState(entity_i, entities, KIDON_SHOT_A2_ACTIVE_FRAMES, KIDON_SHOT_A2_HOMING_FRAMES, KIDON_SHOT_A2_TURN_PER_FRAME, KIDON_SHOT_A2_SPEED);
			break;
		case EntityType.AyinShotA2:
			handleHomingShotState(entity_i, entities, AYIN_SHOT_A2_ACTIVE_FRAMES, AYIN_SHOT_A2_HOMING_FRAMES, AYIN_SHOT_A2_TURN_PER_FRAME, AYIN_SHOT_A2_SPEED);
			break;
		case EntityType.AyinHelperB1AttackShot:
			handleHomingShotState(entity_i, entities, AYIN_HELPER_B1_ATTACK_SHOT_ACTIVE_FRAMES, AYIN_HELPER_B1_ATTACK_SHOT_HOMING_FRAMES, AYIN_HELPER_B1_ATTACK_SHOT_TURN_PER_FRAME, AYIN_HELPER_B1_ATTACK_SHOT_SPEED);
			break;
		case EntityType.AyinHelperB2AttackShot:
			handleHomingShotState(entity_i, entities, AYIN_HELPER_B2_ATTACK_SHOT_ACTIVE_FRAMES, AYIN_HELPER_B2_ATTACK_SHOT_HOMING_FRAMES, AYIN_HELPER_B2_ATTACK_SHOT_TURN_PER_FRAME, AYIN_HELPER_B2_ATTACK_SHOT_SPEED);
			break;
		case EntityType.KidonShotC1Small:			
		case EntityType.KidonShotC2Small:
		case EntityType.AyinShotC1:
			if (--entity.framesToStateChange <= 0)
				entity.shouldBeRemoved = true;
			break;
		case EntityType.AyinHelperB1:
			handleAyinHelperB1State(entity_i, entities, renderables);
			break;
		case EntityType.AyinHelperB2:
			handleAyinHelperB2State(entity_i, entities);
			break;
		default:
			throw new Error("Unsupported entity for handleEntityState");
	}
}

function handleRenderableState(renderable: Renderable) {
	renderable.x += renderable.vx;
	renderable.y += renderable.vy;
	--renderable.remainingFrames;
}

function handleEntityMovement(entity: Entity, player1: Entity, player2: Entity) {
	entity.x += entity.vx;
	entity.y += entity.vy;
}


interface WallCollisionInfo {
	excessNegativeX: number,
	excessNegativeY: number,
	excessPositiveX: number,
	excessPositiveY: number
}


const ENTITY_SHAPE_MAP = new Map<EntityType, ShapeInfo>([	
	[EntityType.KidonShip,KIDON_TRIANGLES],
	[EntityType.KidonShotA1,KIDON_SHOT_A1_TRIANGLES],
	[EntityType.KidonShotA2,KIDON_SHOT_A2_TRIANGLES],
	[EntityType.KidonShotB2,KIDON_SHOT_B2_TRIANGLES],
	[EntityType.KidonShotB1,KIDON_SHOT_B1_TRIANGLES],
	[EntityType.KidonShotC1Big,KIDON_SHOT_C1_BIG_TRIANGLES],
	[EntityType.KidonShotC1Small,KIDON_SHOT_C1_SMALL_TRIANGLES],
	[EntityType.KidonShotC2Big,KIDON_SHOT_C2_BIG_TRIANGLES],
	[EntityType.KidonShotC2Small,KIDON_SHOT_C2_SMALL_TRIANGLES],
	[EntityType.AyinShip,AYIN_SHAPE],
	[EntityType.AyinShotA1,AYIN_SHOT_A1_TRIANGLES],
	[EntityType.AyinShotA2, AYIN_SHOT_A2_TRIANGLES],
	[EntityType.AyinHelperB1,AYIN_HELPER_B1_SHAPE],
	[EntityType.AyinHelperB1AttackShot, AYIN_HELPER_B1_ATTACK_SHOT_SHAPE],
	[EntityType.AyinHelperB2,AYIN_HELPER_B2_SHAPE],
	[EntityType.AyinHelperB2AttackShot, AYIN_HELPER_B2_ATTACK_SHOT_SHAPE],
	[EntityType.AyinShotC1, AYIN_SHOT_C1_TRIANGLES],
	[EntityType.AyinShotC2, AYIN_SHOT_C2_TRIANGLES],
]);
assertDefinedForAllEnum(ENTITY_SHAPE_MAP, EntityType);
	 

let gwcPoint: Point = {x: 0, y: 0};
function getWallCollisions(entity: Entity, collisionInfo: WallCollisionInfo): void {
	collisionInfo.excessPositiveY = collisionInfo.excessPositiveX = collisionInfo.excessNegativeY = collisionInfo.excessNegativeX = -WORLD_WIDTH - WORLD_HEIGHT; // TODO: This is for debug
 	let shape = ENTITY_SHAPE_MAP.get(entity.type)!;
	// TODO: We can possibly optimize this by only checking external points, but is it
	//       worth it?
	if (shape.type === ShapeInfoType.Triangles) {
		const triangles = shape.data;
		for (let i = 0; i < triangles.length; i += 2) {
			let point = gwcPoint;
			let angle = entity.angleInt;
			point.x = triangles[i];
			point.y = triangles[i+1];
			rotateAndScaleAndTranslate(point, angle, entity.scaleWidthPct, entity.scaleHeightPct, entity.x, entity.y);

			if (MIN_X - point.x > collisionInfo.excessNegativeX) collisionInfo.excessNegativeX = MIN_X - point.x;
			if (MIN_Y - point.y > collisionInfo.excessNegativeY) collisionInfo.excessNegativeY = MIN_Y - point.y;
			if (point.x - MAX_X > collisionInfo.excessPositiveX) collisionInfo.excessPositiveX = point.x - MAX_X;
			if (point.y - MAX_Y > collisionInfo.excessPositiveY) collisionInfo.excessPositiveY = point.y - MAX_Y;
		}
	} else if (shape.type === ShapeInfoType.Circles) {
		const circles = shape.data;
		for (let i = 0; i < circles.length; i += 3) {
			const x = entity.x + circles[i + 0];
			const y = entity.y + circles[i + 1];
			const r = circles[i + 2];
			const x1 = x - r;
			const x2 = x + r;
			const y1 = y - r;
			const y2 = y + r;
			if (MIN_X - x1 > collisionInfo.excessNegativeX) collisionInfo.excessNegativeX = MIN_X - x1;
			if (MIN_Y - y1 > collisionInfo.excessNegativeY) collisionInfo.excessNegativeY = MIN_Y - y1;
			if (x2 - MAX_X > collisionInfo.excessPositiveX) collisionInfo.excessPositiveX = x2 - MAX_X;
			if (y2 - MAX_Y > collisionInfo.excessPositiveY) collisionInfo.excessPositiveY = y2 - MAX_Y;
		}
	}
}

function handleWallCollisionVelocityChange(entity: Entity, wci: WallCollisionInfo) {
	if (wci.excessNegativeX > 0) {
		entity.vx = -entity.vx;
		entity.x += wci.excessNegativeX;
	}
	if (wci.excessNegativeY > 0) {
		entity.vy = -entity.vy;
		entity.y += wci.excessNegativeY;
	}
	if (wci.excessPositiveX > 0) {
		entity.vx = -entity.vx;
		entity.x -= wci.excessPositiveX;
	}
	if (wci.excessPositiveY > 0) {
		entity.vy = -entity.vy;
		entity.y -= wci.excessPositiveY;
	}
}

function handleShipWallCollision(entity: Entity, wci: WallCollisionInfo): void {
	const state = getEntityState(entity);
	const hasCollision = wci.excessPositiveX > 0 || wci.excessPositiveY > 0 || wci.excessNegativeX > 0 || wci.excessNegativeY > 0;
	handleWallCollisionVelocityChange(entity, wci);
	if (hasCollision && state !== EntityState.Hitstun && state !== EntityState.Blockstun) {
		disableShipWarp(entity);
		entity.hp -= WALL_DAMAGE;
	}
}

function handleShotWallCollision(entity: Entity, wci: WallCollisionInfo): void {}

function handleHelperWallCollision(entity: Entity, wci: WallCollisionInfo): void {
	const hasCollision = wci.excessPositiveX > 0 || wci.excessPositiveY > 0 || wci.excessNegativeX > 0 || wci.excessNegativeY > 0;
	handleWallCollisionVelocityChange(entity, wci);
	if (hasCollision) {
		disableShipWarp(entity);
		entity.hp -= WALL_DAMAGE;
		if (entity.hp < 0)
			entity.shouldBeRemoved = true;
	}
}

type WallCollisionHandler = { (entity: Entity, wci: WallCollisionInfo): void; };
const WALL_COLLISION_HANDLER_MAP = new Map<EntityType, WallCollisionHandler>(
	SHIP_LIST.map(ship => <[EntityType, WallCollisionHandler]> [ship, handleShipWallCollision]).concat(
		[[EntityType.KidonShotA1, handleShotWallCollision],
		 [EntityType.KidonShotA2, handleShotWallCollision],
		 [EntityType.KidonShotB1, handleShotWallCollision],
		 [EntityType.KidonShotB2, handleShotWallCollision],
		 [EntityType.KidonShotC1Big, handleShotWallCollision],
		 [EntityType.KidonShotC1Small, handleShotWallCollision],
		 [EntityType.KidonShotC2Big, handleShotWallCollision],
		 [EntityType.KidonShotC2Small, handleShotWallCollision],
		 [EntityType.AyinShotA1, handleShotWallCollision],
		 [EntityType.AyinShotA2, handleShotWallCollision],
		 [EntityType.AyinHelperB1AttackShot, handleShotWallCollision],
		 [EntityType.AyinHelperB2AttackShot, handleShotWallCollision],
		 [EntityType.AyinShotC1, handleShotWallCollision],
		 [EntityType.AyinShotC2, handleShotWallCollision],
		 [EntityType.AyinHelperB1, handleHelperWallCollision],
		 [EntityType.AyinHelperB2, function() {}]]));
assertDefinedForAllEnum(WALL_COLLISION_HANDLER_MAP, EntityType);


function handleWallCollisions(entity: Entity, wci: WallCollisionInfo) {
	WALL_COLLISION_HANDLER_MAP.get(entity.type)!(entity, wci);
	// const state = getEntityState(entity);
	// const hasCollision = wci.excessPositiveX > 0 || wci.excessPositiveY > 0 || wci.excessNegativeX > 0 || wci.excessNegativeY > 0;
	// switch (entity.type) {
	// 	case EntityType.KidonShip:
	// 	case EntityType.AyinShip:
	// 		break;
	// 	case EntityType.KidonShotA1:
	// 	case EntityType.KidonShotA2:
	// 	case EntityType.KidonShotB1:
	// 	case EntityType.KidonShotB2:
	// 	case EntityType.KidonShotC1Big:
	// 	case EntityType.KidonShotC1Small:
	// 	case EntityType.KidonShotC2Big:
	// 	case EntityType.KidonShotC2Small:
	// 	case EntityType.AyinShotA1:
	// 	case EntityType.AyinHelperB1AttackShot:
	// 	case EntityType.AyinShotA2:
	// 		// TODO: Do nothing for now, in the future we should remove the shots from the game.
	// 		break;
	// 	case EntityType.AyinHelperB1:
	// 		handleWallCollisionVelocityChange(entity, wci);
	// 		if (hasCollision) {
	// 			disableShipWarp(entity);
	// 			entity.hp -= WALL_DAMAGE;
	// 			if (entity.hp < 0)
	// 				entity.shouldBeRemoved = true;
	// 		}
	// 		break;
	// 	default:
	// 		throw new Error("handleCollisions does not handle this");
	// }
}

const ENTITY_COARSE_RADIUS_MAP = new Map<EntityType, number>(
	[[EntityType.KidonShip, KIDON_COARSE_RADIUS],
	 [EntityType.AyinShip, AYIN_COARSE_RADIUS],
	 [EntityType.KidonShotA1,  KIDON_SHOT_A1_COARSE_RADIUS],
	 [EntityType.KidonShotA2,  KIDON_SHOT_A2_COARSE_RADIUS],
	 [EntityType.KidonShotB2,  KIDON_SHOT_B2_COARSE_RADIUS],
	 [EntityType.KidonShotB1,  KIDON_SHOT_B1_COARSE_RADIUS],
	 [EntityType.KidonShotC1Big,  KIDON_SHOT_C1_BIG_COARSE_RADIUS],
	 [EntityType.KidonShotC1Small,  KIDON_SHOT_C1_SMALL_COARSE_RADIUS],
	 [EntityType.KidonShotC2Big,  KIDON_SHOT_C2_BIG_COARSE_RADIUS],
	 [EntityType.KidonShotC2Small,  KIDON_SHOT_C2_SMALL_COARSE_RADIUS],
	 [EntityType.AyinShotA1, AYIN_SHOT_A1_COARSE_RADIUS],
	 [EntityType.AyinShotA2, getCoarseRadius(AYIN_SHOT_A2_TRIANGLES)],
	 [EntityType.AyinHelperB1, AYIN_HELPER_B1_COARSE_RADIUS],
	 [EntityType.AyinHelperB1AttackShot, getCoarseRadius(AYIN_HELPER_B1_ATTACK_SHOT_SHAPE)],
	 [EntityType.AyinHelperB2, getCoarseRadius(AYIN_HELPER_B2_SHAPE)],
	 [EntityType.AyinHelperB2AttackShot, getCoarseRadius(AYIN_HELPER_B2_ATTACK_SHOT_SHAPE)],
	 [EntityType.AyinShotC1, getCoarseRadius(AYIN_SHOT_C1_TRIANGLES)],
	 [EntityType.AyinShotC2, getCoarseRadius(AYIN_SHOT_C2_TRIANGLES)]]);
assertDefinedForAllEnum(ENTITY_COARSE_RADIUS_MAP, EntityType);

// TODO: Lots of the collision related function here should be moved to spatial.ts
function getEntityCoarseRadius(type: EntityType) {
	return ENTITY_COARSE_RADIUS_MAP.get(type)!;
}

function coarseCollision(entity1: Entity, entity2: Entity) {
	let r1 = getEntityCoarseRadius(entity1.type);
	let r2 = getEntityCoarseRadius(entity2.type);
	return norm2sq(entity1.x - entity2.x, entity1.y - entity2.y) < (r1 + r2) * (r1 + r2);
}

function fineCollision(e1: Entity, e2: Entity) {
	return fineShapeCollision(e1.x, e1.y, e1.angleInt, e1.scaleWidthPct, e1.scaleHeightPct, ENTITY_SHAPE_MAP.get(e1.type)!,
							  e2.x, e2.y, e2.angleInt, e2.scaleWidthPct, e2.scaleHeightPct, ENTITY_SHAPE_MAP.get(e2.type)!);
}

function handleElasticCollision(state: GameState, entity1: Entity, entity2: Entity, mass1: number, mass2: number) {
	disableShipWarp(entity1);
	disableShipWarp(entity2);
	
	// TODO: For now, I assume all objects have the same mass.

	// See https://en.wikipedia.org/wiki/Elastic_collision#Two-dimensional
	let dx = entity1.x - entity2.x;
	let dy = entity1.y - entity2.y
	let dotProd = (entity1.vx - entity2.vx) * dx + (entity1.vy - entity2.vy) * dy;
	let denom = dx * dx + dy * dy;
	let accelX = -safeDiv(dx * dotProd, denom);
	let accelY = -safeDiv(dy * dotProd, denom);
	let massSum = mass1 + mass2;
	entity1.vx += safeDiv(accelX * (2 * mass2), massSum);
	entity1.vy += safeDiv(accelY * (2 * mass2), massSum);
	entity2.vx -= safeDiv(accelX * (2 * mass1), massSum);
	entity2.vy -= safeDiv(accelY * (2 * mass1), massSum);


	let step = 1;
	let norm2 = safeSqrt(norm2sq(dx, dy));
	while (fineCollision(entity1, entity2)) {
		entity1.x += safeDiv(step * dx, norm2);
		entity1.y += safeDiv(step * dy, norm2);
		entity2.x -= safeDiv(step * dx, norm2);
		entity2.y -= safeDiv(step * dy, norm2);
		step *= 2;
	}	
}

function handleShipShipCollision(state: GameState, entity1: Entity, entity2: Entity) {
	handleElasticCollision(state, entity1, entity2, 1, 1);
}

function handleShipHelperCollision(state: GameState, entity1: Entity, entity2: Entity) {
	handleElasticCollision(state, entity1, entity2, 10, 1);
}

function handleHelperShipCollision(state: GameState, entity1: Entity, entity2: Entity) {
	handleElasticCollision(state, entity1, entity2, 1, 10);
}

function handleHelperHelperCollision(state: GameState, entity1: Entity, entity2: Entity) {
	handleElasticCollision(state, entity1, entity2, 1, 1);	
}

const IS_DISAPPEAR_ON_HIT_MAP = (() => {
	let map = new Map<EntityType, boolean>();
	map.set(EntityType.KidonShotB1, true);
	map.set(EntityType.KidonShotB2, true);
	map.set(EntityType.KidonShotA1, true);
	map.set(EntityType.KidonShotA2, true);
	map.set(EntityType.KidonShotC1Big, true);
	map.set(EntityType.KidonShotC1Small, true);
	map.set(EntityType.KidonShotC2Big, true);
	map.set(EntityType.KidonShotC2Small, true);
	map.set(EntityType.AyinShotA1, true);
	map.set(EntityType.AyinShotA2, false); // First one that is false.
	map.set(EntityType.AyinHelperB1, true);
	map.set(EntityType.AyinHelperB1AttackShot, true);
	map.set(EntityType.AyinHelperB2, true);
	map.set(EntityType.AyinHelperB2AttackShot, true);
	map.set(EntityType.AyinShotC1, true);
	map.set(EntityType.AyinShotC2, true);
	return map;
})();
assertDefinedForAllEnumExcept(IS_DISAPPEAR_ON_HIT_MAP, EntityType, SHIP_SET);

const ACCEL_ON_BLOCK_MAP =
	new Map<EntityType, number>([[EntityType.KidonShotA1, KIDON_SHOT_A1_ACCEL_ON_BLOCK],
								 [EntityType.KidonShotA2, KIDON_SHOT_A2_ACCEL_ON_BLOCK],
								 [EntityType.KidonShotB2, KIDON_SHOT_B2_ACCEL_ON_BLOCK],
								 [EntityType.KidonShotB1, KIDON_SHOT_B1_ACCEL_ON_BLOCK],
								 [EntityType.KidonShotC1Big, KIDON_SHOT_C1_BIG_ACCEL_ON_BLOCK],
								 [EntityType.KidonShotC1Small, KIDON_SHOT_C1_SMALL_ACCEL_ON_BLOCK],
								 [EntityType.KidonShotC2Big, KIDON_SHOT_C2_BIG_ACCEL_ON_BLOCK],
								 [EntityType.KidonShotC2Small, KIDON_SHOT_C2_SMALL_ACCEL_ON_BLOCK],
								 [EntityType.AyinShotA1, AYIN_SHOT_A1_ACCEL_ON_BLOCK],
								 [EntityType.AyinShotA2, 0],
								 [EntityType.AyinHelperB1AttackShot, AYIN_HELPER_B1_ATTACK_SHOT_ACCEL_ON_BLOCK],
								 [EntityType.AyinHelperB2AttackShot, AYIN_HELPER_B2_ATTACK_SHOT_ACCEL_ON_BLOCK],
								 [EntityType.AyinShotC1, AYIN_SHOT_C1_ACCEL_ON_BLOCK],
								 [EntityType.AyinShotC2, AYIN_SHOT_C2_ACCEL_ON_BLOCK],
								]);
assertDefinedForAllEnumExcept(ACCEL_ON_BLOCK_MAP, EntityType, new Set<EntityType>(SHIP_AND_HELPER_LIST));

const ACCEL_ON_HIT_MAP =
	new Map<EntityType, number>([[EntityType.KidonShotA1, KIDON_SHOT_A1_ACCEL_ON_HIT],
								 [EntityType.KidonShotA2, KIDON_SHOT_A2_ACCEL_ON_HIT],
								 [EntityType.KidonShotB2, KIDON_SHOT_B2_ACCEL_ON_HIT],
								 [EntityType.KidonShotB1, KIDON_SHOT_B1_ACCEL_ON_HIT],
								 [EntityType.KidonShotC1Big, KIDON_SHOT_C1_BIG_ACCEL_ON_HIT],
								 [EntityType.KidonShotC1Small, KIDON_SHOT_C1_SMALL_ACCEL_ON_HIT],
								 [EntityType.KidonShotC2Big, KIDON_SHOT_C2_BIG_ACCEL_ON_HIT],
								 [EntityType.KidonShotC2Small, KIDON_SHOT_C2_SMALL_ACCEL_ON_HIT],
								 [EntityType.AyinShotA1, AYIN_SHOT_A1_ACCEL_ON_HIT],
								 [EntityType.AyinShotA2, 0],
								 [EntityType.AyinHelperB1AttackShot, AYIN_HELPER_B1_ATTACK_SHOT_ACCEL_ON_HIT],
								 [EntityType.AyinHelperB2AttackShot, AYIN_HELPER_B2_ATTACK_SHOT_ACCEL_ON_HIT],
								 [EntityType.AyinShotC1, AYIN_SHOT_C1_ACCEL_ON_HIT],
								 [EntityType.AyinShotC2, AYIN_SHOT_C2_ACCEL_ON_HIT],
								]);
assertDefinedForAllEnumExcept(ACCEL_ON_HIT_MAP, EntityType, new Set<EntityType>(SHIP_AND_HELPER_LIST));

const BLOCKSTUN_FRAMES_MAP =
	new Map<EntityType, number>([[EntityType.KidonShotA1, KIDON_SHOT_A1_BLOCKSTUN_FRAMES],
								 [EntityType.KidonShotA2, KIDON_SHOT_A2_BLOCKSTUN_FRAMES],
								 [EntityType.KidonShotB2, KIDON_SHOT_B2_BLOCKSTUN_FRAMES],
								 [EntityType.KidonShotB1, KIDON_SHOT_B1_BLOCKSTUN_FRAMES],
								 [EntityType.KidonShotC1Big, KIDON_SHOT_C1_BIG_BLOCKSTUN_FRAMES],
								 [EntityType.KidonShotC1Small, KIDON_SHOT_C1_SMALL_BLOCKSTUN_FRAMES],
								 [EntityType.KidonShotC2Big, KIDON_SHOT_C2_BIG_BLOCKSTUN_FRAMES],
								 [EntityType.KidonShotC2Small, KIDON_SHOT_C2_SMALL_BLOCKSTUN_FRAMES],
								 [EntityType.AyinShotA1, AYIN_SHOT_A1_BLOCKSTUN_FRAMES],
								 [EntityType.AyinHelperB1AttackShot, AYIN_HELPER_B1_ATTACK_SHOT_BLOCKSTUN_FRAMES],
								 [EntityType.AyinHelperB2AttackShot, AYIN_HELPER_B2_ATTACK_SHOT_BLOCKSTUN_FRAMES],
								 [EntityType.AyinShotA2, AYIN_SHOT_A2_BLOCKSTUN_FRAMES],
								 [EntityType.AyinShotC1, AYIN_SHOT_C1_BLOCKSTUN_FRAMES],
								 [EntityType.AyinShotC2, AYIN_SHOT_C2_BLOCKSTUN_FRAMES],
								]);
assertDefinedForAllEnumExcept(BLOCKSTUN_FRAMES_MAP, EntityType, new Set<EntityType>(SHIP_AND_HELPER_LIST));

const HITSTUN_FRAMES_MAP =
	new Map<EntityType, number>([[EntityType.KidonShotA1, KIDON_SHOT_A1_HITSTUN_FRAMES],
								 [EntityType.KidonShotA2, KIDON_SHOT_A2_HITSTUN_FRAMES],
								 [EntityType.KidonShotB2, KIDON_SHOT_B2_HITSTUN_FRAMES],
								 [EntityType.KidonShotB1, KIDON_SHOT_B1_HITSTUN_FRAMES],
								 [EntityType.KidonShotC1Big, KIDON_SHOT_C1_BIG_HITSTUN_FRAMES],
								 [EntityType.KidonShotC1Small, KIDON_SHOT_C1_SMALL_HITSTUN_FRAMES],
								 [EntityType.KidonShotC2Big, KIDON_SHOT_C2_BIG_HITSTUN_FRAMES],
								 [EntityType.KidonShotC2Small, KIDON_SHOT_C2_SMALL_HITSTUN_FRAMES],
								 [EntityType.AyinShotA1, AYIN_SHOT_A1_HITSTUN_FRAMES],
								 [EntityType.AyinHelperB1AttackShot, AYIN_HELPER_B1_ATTACK_SHOT_HITSTUN_FRAMES],
								 [EntityType.AyinHelperB2AttackShot, AYIN_HELPER_B2_ATTACK_SHOT_HITSTUN_FRAMES],
								 [EntityType.AyinShotA2, AYIN_SHOT_A2_HITSTUN_FRAMES],
								 [EntityType.AyinShotC1, AYIN_SHOT_C1_HITSTUN_FRAMES],
								 [EntityType.AyinShotC2, AYIN_SHOT_C2_HITSTUN_FRAMES],
								]);
assertDefinedForAllEnumExcept(HITSTUN_FRAMES_MAP, EntityType, new Set<EntityType>(SHIP_AND_HELPER_LIST));

const BLOCKED_DAMAGE_MAP =
	new Map<EntityType, number>([[EntityType.KidonShotA1, KIDON_SHOT_A1_BLOCKED_DAMAGE],
								 [EntityType.KidonShotA2, KIDON_SHOT_A2_BLOCKED_DAMAGE],
								 [EntityType.KidonShotB2, KIDON_SHOT_B2_BLOCKED_DAMAGE],
								 [EntityType.KidonShotB1, KIDON_SHOT_B1_BLOCKED_DAMAGE],
								 [EntityType.KidonShotC1Big, KIDON_SHOT_C1_BIG_BLOCKED_DAMAGE],
								 [EntityType.KidonShotC1Small, KIDON_SHOT_C1_SMALL_BLOCKED_DAMAGE],
								 [EntityType.KidonShotC2Big, KIDON_SHOT_C2_BIG_BLOCKED_DAMAGE],
								 [EntityType.KidonShotC2Small, KIDON_SHOT_C2_SMALL_BLOCKED_DAMAGE],
								 [EntityType.AyinShotA1, AYIN_SHOT_A1_BLOCKED_DAMAGE],
								 [EntityType.AyinHelperB1AttackShot, AYIN_HELPER_B1_ATTACK_SHOT_BLOCKED_DAMAGE],
								 [EntityType.AyinHelperB2AttackShot, AYIN_HELPER_B2_ATTACK_SHOT_BLOCKED_DAMAGE],
								 [EntityType.AyinShotA2, 0],
								 [EntityType.AyinShotC1, AYIN_SHOT_C1_BLOCKED_DAMAGE],
								 [EntityType.AyinShotC2, AYIN_SHOT_C2_BLOCKED_DAMAGE],
								]);
assertDefinedForAllEnumExcept(BLOCKED_DAMAGE_MAP, EntityType, new Set<EntityType>(SHIP_AND_HELPER_LIST));

const HIT_DAMAGE_MAP =
	new Map<EntityType, number>([[EntityType.KidonShotA1, KIDON_SHOT_A1_HIT_DAMAGE],
								 [EntityType.KidonShotA2, KIDON_SHOT_A2_HIT_DAMAGE],
								 [EntityType.KidonShotB2, KIDON_SHOT_B2_HIT_DAMAGE],
								 [EntityType.KidonShotB1, KIDON_SHOT_B1_HIT_DAMAGE],
								 [EntityType.KidonShotC1Big, KIDON_SHOT_C1_BIG_HIT_DAMAGE],
								 [EntityType.KidonShotC1Small, KIDON_SHOT_C1_SMALL_HIT_DAMAGE],
								 [EntityType.KidonShotC2Big, KIDON_SHOT_C2_BIG_HIT_DAMAGE],
								 [EntityType.KidonShotC2Small, KIDON_SHOT_C2_SMALL_HIT_DAMAGE],
								 [EntityType.AyinShotA1, AYIN_SHOT_A1_HIT_DAMAGE],
								 [EntityType.AyinHelperB1AttackShot, AYIN_HELPER_B1_ATTACK_SHOT_HIT_DAMAGE],
								 [EntityType.AyinHelperB2AttackShot, AYIN_HELPER_B2_ATTACK_SHOT_HIT_DAMAGE],
								 [EntityType.AyinShotA2, 0],
								 [EntityType.AyinShotC1, AYIN_SHOT_C1_HIT_DAMAGE],
								 [EntityType.AyinShotC2, AYIN_SHOT_C2_HIT_DAMAGE],
								]);
assertDefinedForAllEnumExcept(HIT_DAMAGE_MAP, EntityType, new Set<EntityType>(SHIP_AND_HELPER_LIST));

const SHOT_DISAPPEARS_ON_IMPACT_MAP =
	new Map<EntityType, boolean>([[EntityType.KidonShotA1, true],
								  [EntityType.KidonShotA2, true],
								  [EntityType.KidonShotB2, false],
								  [EntityType.KidonShotB1, false],
								  [EntityType.KidonShotC1Big, true],
								  [EntityType.KidonShotC1Small, true],
								  [EntityType.KidonShotC2Big, true],
								  [EntityType.KidonShotC2Small, true],
								  [EntityType.AyinShotA1, false],
								  [EntityType.AyinHelperB1AttackShot, true],
								  [EntityType.AyinHelperB2AttackShot, true],
								  [EntityType.AyinShotA2, true],
								  [EntityType.AyinShotC1, true],
								  [EntityType.AyinShotC2, false],
								 ]);
assertDefinedForAllEnumExcept(SHOT_DISAPPEARS_ON_IMPACT_MAP, EntityType, new Set<EntityType>(SHIP_AND_HELPER_LIST));

function disappearOrFadeShot(shot: Entity) {
	if (SHOT_DISAPPEARS_ON_IMPACT_MAP.get(shot.type)) {
		shot.shouldBeRemoved = true;
	} else {
		shot.framesToStateChange = getFadeFrames(shot.type);
		assert(shot.framesToStateChange > 0, "getFadeFrames returned 0 where it should never do that");
		shot.collisionSide = CollisionSide.None;
	}
}

function handleShipShotCollision(state: GameState, ship: Entity, shot: Entity) {
	const angle = shot.angleInt;
	const shipState = getEntityState(ship);
	const isBlocked = (shipState == EntityState.Idle || shipState === EntityState.Blockstun) && (shot.color === ship.color || shot.color === EntityColor.Neutral);
	const accelOnBlock = ACCEL_ON_BLOCK_MAP.get(shot.type)!;
	const dvx = safeCosMul(isBlocked ? ACCEL_ON_BLOCK_MAP.get(shot.type)! : ACCEL_ON_HIT_MAP.get(shot.type)!, angle);
	const dvy = safeSinMul(isBlocked ? ACCEL_ON_BLOCK_MAP.get(shot.type)! : ACCEL_ON_HIT_MAP.get(shot.type)!, angle);
	disableShipWarp(ship);
	if (!isBlocked && shipState !== EntityState.Hitstun) {
		ship.vx = dvx;
		ship.vy = dvy;
		for (let i = 0, l = state.entities.length; i < l; ++i) {
			const entity = state.entities[i];
			if (entity.collisionSide === ship.collisionSide) {
				if (IS_DISAPPEAR_ON_HIT_MAP.get(entity.type)!) {
					entity.shouldBeRemoved = true;
				}
			}
		}
		if (ship.collisionSide === CollisionSide.PlayerOne) state.player2CurrentComboHits = 0;
		else state.player1CurrentComboHits = 0;
	} else {
		ship.vx += dvx;
		ship.vy += dvy;
	}
	if (!isBlocked) {
		if (ship.collisionSide === CollisionSide.PlayerOne) ++state.player2CurrentComboHits;
		else ++state.player1CurrentComboHits;
	}
	disappearOrFadeShot(shot);
	setEntityState(ship,
				   isBlocked ? EntityState.Blockstun : EntityState.Hitstun,
				   isBlocked ? BLOCKSTUN_FRAMES_MAP.get(shot.type)! : HITSTUN_FRAMES_MAP.get(shot.type)!);
	const damage = isBlocked ? BLOCKED_DAMAGE_MAP.get(shot.type)! : HIT_DAMAGE_MAP.get(shot.type)!;
	ship.hp -= damage;
	const type = isBlocked
		? (ship.color === EntityColor.Blue
			? RenderableType.BlueExplosionParticle
			: RenderableType.RedExplosionParticle)
		: RenderableType.WhiteExplosionParticle;
	createExplosionParticles(damage, ship.x, ship.y, state, type);
}

function handleShotShipCollision(state: GameState, shot: Entity, ship: Entity) {
	return handleShipShotCollision(state, ship, shot);
}

function handleHelperShotCollision(state: GameState, helper: Entity, shot: Entity) {
	disappearOrFadeShot(shot);
	const damage = HIT_DAMAGE_MAP.get(shot.type)!;
	helper.hp -= damage;
	if (helper.hp <= 0) helper.shouldBeRemoved = true;
	createExplosionParticles(damage, helper.x, helper.y, state, RenderableType.WhiteExplosionParticle);
}

function handleShotHelperCollision(state: GameState, shot: Entity, helper: Entity) {
	return handleHelperShotCollision(state, helper, shot);
}

function handleShotAShotACollision(state: GameState, e1: Entity, e2: Entity) {
	e1.shouldBeRemoved = true;
	e2.shouldBeRemoved = true;
}

function handleShotAShotBCollision(state: GameState, shotA: Entity, shotB: Entity) {
	shotA.shouldBeRemoved = true;
}

function handleShotBShotACollision(state: GameState, shotB: Entity, shotA: Entity) {
	return handleShotAShotBCollision(state, shotA, shotB);
}

function handleImpossibleCollision(state: GameState, shotB: Entity, shotA: Entity) {
	throw new Error("Impossible collision");
}

type CollisionHandler = { (state: GameState, x: Entity, y: Entity): void; };
const COLLISION_HANDLER_MAP = (() => {
	const SHOT_LIST = [EntityType.KidonShotA1, EntityType.KidonShotA2,
					   EntityType.KidonShotB1, EntityType.KidonShotB2,
					   EntityType.KidonShotC1Big, EntityType.KidonShotC1Small,
					   EntityType.KidonShotC2Big, EntityType.KidonShotC2Small,
					   EntityType.AyinShotA1, EntityType.AyinHelperB1AttackShot, EntityType.AyinHelperB2AttackShot,
					   EntityType.AyinShotA2, EntityType.AyinShotC1, EntityType.AyinShotC2];
	
	
	let map = new Map<EntityType, Map<EntityType, CollisionHandler>>();
	for (const shipType of SHIP_LIST)
		map.set(shipType, new Map<EntityType, CollisionHandler>());
	for (const shotType of SHOT_LIST)
		map.set(shotType, new Map<EntityType, CollisionHandler>());
	for (const helperType of HELPER_LIST)
		map.set(helperType, new Map<EntityType, CollisionHandler>());
	
	for (const shipType of SHIP_LIST) {
		for (const shotType of SHOT_LIST) {
			if (shipType < shotType)
				map.get(shipType)!.set(shotType, handleShipShotCollision);
			else if (shotType < shipType)
				map.get(shotType)!.set(shipType, handleShotShipCollision);
		}
		for (const shipType2 of SHIP_LIST) {
			if (shipType <= shipType2)
				map.get(shipType)!.set(shipType2, handleShipShipCollision);
		}
		for (const helperType of HELPER_LIST) {
			if (shipType < helperType)
				map.get(shipType)!.set(helperType, handleShipHelperCollision);
			else if (helperType < shipType)
				map.get(helperType)!.set(shipType, handleHelperShipCollision);
		}
	}
	
	for (const shotType1 of SHOT_LIST) {
		for (const shotType2 of SHOT_LIST) {
			const shotRank = (type: EntityType) => {
				return (type === EntityType.KidonShotB1 ||
					type === EntityType.KidonShotB2 ||
					type === EntityType.AyinShotA1 ||
					type === EntityType.AyinShotA2) ? 2 : 1;
			};
			if (shotType1 > shotType2) continue;

			const shotRank1 = shotRank(shotType1), shotRank2 = shotRank(shotType2);
			map.get(shotType1)!.set(shotType2,
									(shotRank1 === shotRank2 ? handleShotAShotACollision
										: shotRank1 > shotRank2 ? handleShotBShotACollision
										: handleShotAShotBCollision));
		}
		for (const helperType of HELPER_LIST) {
			if (shotType1 < helperType)
				map.get(shotType1)!.set(helperType, handleShotHelperCollision);
			else if (helperType < shotType1)
				map.get(helperType)!.set(shotType1, handleHelperShotCollision);
		}
	}

	for (const helperType1 of HELPER_LIST) {
		for (const helperType2 of HELPER_LIST) {
			if (helperType1 <= helperType2)
				map.get(helperType1)!.set(helperType2, handleHelperHelperCollision);			
		}
	}
	
	return map;
})();
for (const value1 in EntityType) {
	const value1Num = Number(value1);
	if (isNaN(value1Num)) continue;
	for (const value2 in EntityType) {
		const value2Num = Number(value2);
		if (isNaN(value2Num)) continue;
		if (value1Num <= value2Num && COLLISION_HANDLER_MAP.get(value1Num)!.get(value2Num) == null)
			throw new Error("Missing collision handler function: " + JSON.stringify([value1Num, value2Num]));
		else if (value1Num > value2Num && COLLISION_HANDLER_MAP.get(value1Num)!.get(value2Num) != null)
			throw new Error("Unrequired collision handler function: " + JSON.stringify([value1Num, value2Num]));
	}
}
function handleEntityPairCollision(state: GameState, entity1: Entity, entity2: Entity) {
	if (entity1.type <= entity2.type)
		COLLISION_HANDLER_MAP.get(entity1.type)!.get(entity2.type)!(state, entity1, entity2);
	else
		COLLISION_HANDLER_MAP.get(entity2.type)!.get(entity1.type)!(state, entity2, entity1);
}

function getAndHandleEntityCollisions(entity_i: number, state: GameState) {
	let entities = state.entities;
	let entity = entities[entity_i];
	if (entity.collisionSide === CollisionSide.None)
		return;
	for (let i = entity_i, l = entities.length; i < l; ++i) {
		let otherEntity = entities[i];
		if (otherEntity.collisionSide === CollisionSide.None)
			continue;
		if (entity.collisionSide === otherEntity.collisionSide) // TODO: Should probably have a way to filter these in advance.
			continue;
		if (!coarseCollision(entity, otherEntity))
			continue;

		if (!fineCollision(entity, otherEntity))
			continue;

		handleEntityPairCollision(state, entity, otherEntity);
	}
}

function handleCollisions(entity_i: number, state: GameState) {
	let entity = state.entities[entity_i];
	if (entity.collisionSide === CollisionSide.None)
		return;
	let wci = {excessPositiveY: 0, excessPositiveX: 0, excessNegativeY: 0, excessNegativeX: 0};
	getWallCollisions(entity, wci);
	handleWallCollisions(entity, wci);
	getAndHandleEntityCollisions(entity_i, state);
}

function createExplosionParticles(damage: number, x: number, y: number, state: GameState,
								  type: RenderableType) {
	
	const renderables = state.renderables;
	let size = MIN_EXPLOSION_PARTICLE_SIZE_PCT;
	let damagePerParticle = DAMAGE_PER_SMALLEST_PARTICLE;
	let count = 0;
	while (size <= MAX_EXPLOSION_PARTICLE_SIZE_PCT) {
		console.log("Trying size " + size.toString() + " damagePerParticle is " + damagePerParticle.toString() + " damage is " + damage);
		count = max(MIN_EXPLOSION_PARTICLE_COUNT, safeDiv(damage, damagePerParticle));
		if (count <= MAX_EXPLOSION_PARTICLE_COUNT)
			break;
		size = min(MAX_EXPLOSION_PARTICLE_SIZE_PCT + 1, size * MIN_EXPLOSION_PARTICLE_SIZE_MUL_STEP);
		damagePerParticle = safeDiv(damagePerParticle * MAX_EXPLOSION_PARTICLE_COUNT,
									MIN_EXPLOSION_PARTICLE_COUNT) + 1;
	}
	if (size >= MAX_EXPLOSION_PARTICLE_SIZE_PCT + 1) {
		size = MAX_EXPLOSION_PARTICLE_SIZE_PCT;
		count = MAX_EXPLOSION_PARTICLE_COUNT;
	}
	
	for (let i = 0; i < count; ++i) {
		const angle = rand(state, 0, MAX_INT_ANGLE);
		const speed = rand(state, MIN_EXPLOSION_PARTICLE_SPEED, MAX_EXPLOSION_PARTICLE_SPEED);
		const ttl = rand(state, MIN_EXPLOSION_PARTICLE_FRAMES, MAX_EXPLOSION_PARTICLE_FRAMES);
		const accel = safeDiv(speed, ttl);
		const renderable = {
			type: type,
			x: x,
			y: y,
			angleInt: 0,
			scaleWidthPct: 100,
			scaleHeightPct: 100,
			vx: safeCosMul(speed, angle),
			vy: safeSinMul(speed, angle),
			ax: -safeCosMul(accel, angle),
			ay: -safeSinMul(accel, angle),			
			remainingFrames: ttl,
			totalFrames: ttl,
			sizePct: size,
		};
		renderables.push(renderable);
	}
}

function initialEntities(): Entity[] {
	return [{type: EntityType.AyinShip,
			 hp: ayinInfo.maxHp,
			 batt: 0,
			 warp: 0,
			 x: PLAYER1_START_X,
			 y: PLAYER1_START_Y,
			 vx: 0,
			 vy: 0,
			 preWarpVx: 0,
			 preWarpVy: 0,
			 angleInt: 0,
			 scaleWidthPct: 100,
			 scaleHeightPct: 100,
			 collisionSide: CollisionSide.PlayerOne,
			 stateDoNotTouchDirectly: EntityState.Idle,
			 startupMove: null,
			 framesToStateChange: 0,
			 noStablizeFrames: 0,
			 color: EntityColor.Red,
			 shouldBeRemoved: false},
			{type: EntityType.KidonShip,
			 hp: kidonInfo.maxHp,
			 batt: 0,
			 warp: 0,
			 x: PLAYER2_START_X,
			 y: PLAYER2_START_Y,
			 vx: 0,
			 vy: 0,
			 preWarpVx: 0,
			 preWarpVy: 0,
			 angleInt: 0,
			 scaleWidthPct: 100,
			 scaleHeightPct: 100,
			 collisionSide: CollisionSide.PlayerTwo,
			 stateDoNotTouchDirectly: EntityState.Idle,
			 startupMove: null,
			 framesToStateChange: 0,
			 noStablizeFrames: 0,
			 color: EntityColor.Red,
			 shouldBeRemoved: false}];
}

function initState(state: GameState) {
	let player1InputHistory = new Array(256).fill(0);
	let player2InputHistory = new Array(256).fill(0);

	state.entities = initialEntities();
	state.player1InputHistory = player1InputHistory,
	state.player1InputHistoryNextIndex = 0,
	state.player2InputHistory = player2InputHistory,
	state.player2InputHistoryNextIndex = 0,
	state.player1CurrentComboHits = 0,
	state.player2CurrentComboHits = 0,
	state.winScreen = WinScreen.None,
	state.winScreenRemainingFrames = 0
}

export function createGameState(): GameState {
	// Values should be initialized in initState, here we only set up the type shape.
	let state: GameState = {entities: [],
							renderables: [],
							player1InputHistory: [],
							player1InputHistoryNextIndex: -999,
							player2InputHistory: [],
							player2InputHistoryNextIndex: -999,
							player1CurrentComboHits: -999,
							player2CurrentComboHits: -999,
							winScreen: WinScreen.Draw,
							winScreenRemainingFrames: -999,
							mulberryState: 0};
	initState(state);
	return state;
}

function updateInputHistory(state: GameState, inputs: number[]) {
	state.player1InputHistory[state.player1InputHistoryNextIndex++] = inputs[0];
	state.player2InputHistory[state.player2InputHistoryNextIndex++] = inputs[1];
	state.player1InputHistoryNextIndex %= state.player1InputHistory.length;
	state.player2InputHistoryNextIndex %= state.player2InputHistory.length;
	// if (inputs[0] != 0) {
	// 	console.log("DEBUG: " + state.player1InputHistoryNextIndex + "," + inputs[0]);
	// }
}

function removeEntities(state: GameState) {
	const newEntities = [];
	newEntities.length = state.entities.length;
	let newEntitiesLength = 0;
	for (let i = 0, l1 = state.entities.length; i < l1; ++i) {
		if (!state.entities[i].shouldBeRemoved)
			newEntities[newEntitiesLength++] = state.entities[i];
	}
	newEntities.length = newEntitiesLength;
	state.entities = newEntities;
}

function removeRenderables(state: GameState) {
	const newRenderables = [];
	newRenderables.length = state.renderables.length;
	let newRenderablesLength = 0;
	for (let i = 0, l1 = state.renderables.length; i < l1; ++i) {
		if (state.renderables[i].remainingFrames > 0)
			newRenderables[newRenderablesLength++] = state.renderables[i];
	}
	newRenderables.length = newRenderablesLength;
	state.renderables = newRenderables;	
}

export function updateGameState(state: GameState, inputs: number[], winningSyncData: GameSyncData): void {
	if (state.winScreen !== WinScreen.None) {
		if (--state.winScreenRemainingFrames <= 0) {
			initState(state);
		}
		return;
	}
	
	for (let i = 0, l = state.entities.length; i < l; ++i) {
		handleEntityMovement(state.entities[i], state.entities[PLAYER1_INDEX], state.entities[PLAYER2_INDEX]);
		handleCollisions(i, state);
	}
	
	handleEntityKeyboard(PLAYER1_INDEX, state, inputs[0], state.player1InputHistory, state.player1InputHistoryNextIndex);
	handleEntityKeyboard(PLAYER2_INDEX, state, inputs[1], state.player2InputHistory, state.player2InputHistoryNextIndex);

	// TODO: handleEntityState may add new entities, it might be better to add them all in one go?
	for (let i = 0, l = state.entities.length; i < l; ++i)
		handleEntityState(i, state);

	// NOTE: each renderable should be independent and stupid. If this function suddenly needs to
	//       get gamestate, something's wrong.
	for (let i = 0, l = state.renderables.length; i < l; ++i)
		handleRenderableState(state.renderables[i]);
	
	updateInputHistory(state, inputs);
	removeEntities(state);
	removeRenderables(state);
	
	if (state.entities[PLAYER1_INDEX].hp <= 0) {
		state.winScreen = state.entities[PLAYER2_INDEX].hp <= 0 ? WinScreen.Draw : WinScreen.Player1;
		state.winScreenRemainingFrames = WIN_SCREEN_FRAMES;
	} else if (state.entities[PLAYER2_INDEX].hp <= 0) {
		state.winScreen = WinScreen.Player2;
		state.winScreenRemainingFrames = WIN_SCREEN_FRAMES;
	}
}

export function getFadeFrames(type: EntityType) {
	switch (type) {
		case EntityType.KidonShotB1:
			return KIDON_SHOT_B1_FADE_FRAMES;
		case EntityType.KidonShotB2:
			return KIDON_SHOT_B2_FADE_FRAMES;
		case EntityType.AyinShotA1:
			return AYIN_SHOT_A1_FADE_FRAMES;
		case EntityType.AyinShotC2:
			return AYIN_SHOT_C2_FADE_FRAMES;
		default:
			return 0;
	}
}
