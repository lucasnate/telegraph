// TODO: This file needs to have float protection

import { SyncData, InputValues } from '../../src/types';
import { RingBuffer } from '../../src/util/RingBuffer';
import { safeDiv, safeSqrt, MAX_INT_ANGLE, safeCosMul, safeSinMul, safeAtan2, abs, angleDiff, normalizeAngle, min, max } from './safeCalc';
import { abstractKeyUpMask, abstractKeyLeftMask, abstractKeyRightMask, abstractKeyDownMask, abstractKeySwitchMask, abstractKeyAMask, abstractKeyBMask } from './Inputter';

import { KIDON_WIDTH, KIDON_HEIGHT, KIDON_SHOT_A_WIDTH, KIDON_TRIANGLES, KIDON_SHOT_A_TRIANGLES, KIDON_SHOT_B_TRIANGLES, KIDON_COARSE_RADIUS, KIDON_SHOT_A_COARSE_RADIUS, KIDON_SHOT_B_COARSE_RADIUS } from './shipShapes';
import { Point, rotateAndTranslate } from './spatial';
import { assert } from '../../src/util/assert';

// TODO: Most important before everything, a constant silent sound.
// TODO: Should have two different buttons for color switch
// TODO: Battery
// TODO: Weapon 2A
// TODO: Shift
// TODO: Weapon Shift-A
// TODO: Weapon B
// TODO: At some point we should get rid of many of our maps and have a type representing the
//       entity type. Something like a prototype :)
// TODO: Add an assert that *_FRAMES are not negative.


// TODO: Need to get these things through syncData
export const WORLD_WIDTH = 100000;
export const WORLD_HEIGHT = 100000;
export const KIDON_MAX_HP = 10000;
export const KIDON_MAX_SPEED = safeDiv(KIDON_HEIGHT, 10);
export const KIDON_FULL_ACCEL_FRAMES = 20;
export const KIDON_ACCEL = safeDiv(KIDON_MAX_SPEED, KIDON_FULL_ACCEL_FRAMES);
export const KIDON_STABLIZE_ACCEL = safeDiv(KIDON_ACCEL, 4);
export const KIDON_FULL_TURN_FRAMES = 60;
export const KIDON_TURN_PER_FRAME = safeDiv(MAX_INT_ANGLE, KIDON_FULL_TURN_FRAMES);
export const KIDON_SHOT_A_STARTUP_FRAMES = 4;
export const KIDON_SHOT_A_ACTIVE_FRAMES = 18;
export const KIDON_SHOT_A_RECOVERY_FRAMES = 4;
export const KIDON_SHOT_A_ADVANTAGE_ON_HIT = 13;
export const KIDON_SHOT_A_ADVANTAGE_ON_BLOCK = -1;
export const KIDON_SHOT_A_HITSTUN_FRAMES = KIDON_SHOT_A_RECOVERY_FRAMES + KIDON_SHOT_A_ADVANTAGE_ON_HIT;
export const KIDON_SHOT_A_BLOCKSTUN_FRAMES = KIDON_SHOT_A_RECOVERY_FRAMES + KIDON_SHOT_A_ADVANTAGE_ON_BLOCK;
export const KIDON_SHOT_A_RANGE = KIDON_WIDTH * 4;
export const KIDON_SHOT_A_SPEED = safeDiv(KIDON_SHOT_A_RANGE, KIDON_SHOT_A_ACTIVE_FRAMES);
assert(KIDON_SHOT_A_SPEED < safeDiv(KIDON_SHOT_A_WIDTH, 2), "Kidon shot A is too fast! " + KIDON_SHOT_A_SPEED + "," + KIDON_SHOT_A_WIDTH);
assert(KIDON_SHOT_A_SPEED > KIDON_MAX_SPEED * 2, "Kidon shot A is too slow! " + KIDON_SHOT_A_SPEED + "," + KIDON_MAX_SPEED);
export const KIDON_SHOT_A_HOMING_FRAMES = 6;
export const KIDON_SHOT_A_TOTAL_TURN = safeDiv(MAX_INT_ANGLE, 8);
export const KIDON_SHOT_A_TURN_PER_FRAME = safeDiv(KIDON_SHOT_A_TOTAL_TURN, KIDON_SHOT_A_HOMING_FRAMES);
export const KIDON_SHOT_A_ACCEL_ON_HIT = safeDiv(KIDON_MAX_SPEED, 4);
export const KIDON_SHOT_A_ACCEL_ON_BLOCK = safeDiv(KIDON_MAX_SPEED, 16);
export const KIDON_SHOT_A_BLOCKED_DAMAGE = 30;
export const KIDON_SHOT_A_HIT_DAMAGE = 300;

export const KIDON_SHOT_B_STARTUP_FRAMES = 15;
export const KIDON_SHOT_B_ACTIVE_FRAMES = 5;
export const KIDON_SHOT_B_RECOVERY_FRAMES = 20;
export const KIDON_SHOT_B_ACCEL_ON_HIT = safeDiv(KIDON_MAX_SPEED, 4);
export const KIDON_SHOT_B_ACCEL_ON_BLOCK = safeDiv(KIDON_MAX_SPEED, 16);
export const KIDON_SHOT_B_ADVANTAGE_ON_HIT = 18;
export const KIDON_SHOT_B_ADVANTAGE_ON_BLOCK = -10;
export const KIDON_SHOT_B_HITSTUN_FRAMES = KIDON_SHOT_B_ACTIVE_FRAMES + KIDON_SHOT_B_RECOVERY_FRAMES + KIDON_SHOT_B_ADVANTAGE_ON_HIT;
export const KIDON_SHOT_B_BLOCKSTUN_FRAMES = KIDON_SHOT_B_ACTIVE_FRAMES + KIDON_SHOT_B_RECOVERY_FRAMES + KIDON_SHOT_B_ADVANTAGE_ON_BLOCK;
export const KIDON_SHOT_B_BLOCKED_DAMAGE = 90;
export const KIDON_SHOT_B_HIT_DAMAGE = 900;

const WIN_SCREEN_FRAMES = 300;


const PLAYER1_START_X = -safeDiv(WORLD_WIDTH, 6);
const PLAYER1_START_Y = -safeDiv(WORLD_HEIGHT, 6);
const PLAYER2_START_X = +safeDiv(WORLD_WIDTH, 6);
const PLAYER2_START_Y = +safeDiv(WORLD_HEIGHT, 6);
export const PLAYER1_INDEX = 0;
export const PLAYER2_INDEX = 1;
export const MIN_X = -safeDiv(WORLD_WIDTH, 2);
export const MAX_X = +safeDiv(WORLD_WIDTH, 2);
export const MIN_Y = -safeDiv(WORLD_HEIGHT, 2);
export const MAX_Y = +safeDiv(WORLD_HEIGHT, 2);

const FRAMES_TO_IDLE_AFTER_UP = 1;

export interface GameSyncData extends SyncData {}

export enum EntityType {
	Ship,
	ShotA,
	ShotB
}

enum CollisionSide {
	PlayerOne,
	PlayerTwo,
	None
}

export enum EntityState {
	Idle,
	Moving, // TODO: Can "moving" be merged with "recovery"? Should it?
	Startup,
	Active,
	Recovery,
	Hitstun,
	Blockstun,
}

export enum EntityColor {
	Red, Blue, Neutral
}

export interface Entity {
	type: EntityType,
	hp: number,
	x: number,
	y: number,
	vx: number,
	vy: number,
	angleInt: number,
	collisionSide: CollisionSide,

	state: EntityState,
	startupMove: Move | null,
	framesToStateChange: number,

	color: EntityColor,

	shouldBeRemoved: boolean
}

export enum WinScreen {
	None,
	Player1,
	Player2,
	Draw
}

export interface GameState {
	entities: Entity[],
	player1InputHistory: number[],
	player1InputHistoryNextIndex: number,
	player2InputHistory: number[],
	player2InputHistoryNextIndex: number,
	player1CurrentComboHits: number,
	player2CurrentComboHits: number,
	winScreen: WinScreen,
	winScreenRemainingFrames: number
}

function norm2sq(x: number,y: number): number {
	return x*x + y*y;
}

function handleEntityKeyboard(entity: Entity, input: number, inputHistory: number[], inputHistoryNextIndex: number) {
	const stun = entity.state === EntityState.Hitstun || entity.state === EntityState.Blockstun || entity.state === EntityState.Active;
	const usingWeapon = entity.state === EntityState.Startup || entity.state === EntityState.Active || entity.state === EntityState.Recovery;
	const lastInput = inputHistory[inputHistoryNextIndex - 1 < 0 ? (inputHistory.length - 1) : inputHistoryNextIndex - 1];
	if ((input & abstractKeyAMask) && !(lastInput & abstractKeyAMask) && !stun && !usingWeapon) {
		entity.state = EntityState.Startup;
		entity.startupMove = Move._5A;
		entity.framesToStateChange = KIDON_SHOT_A_STARTUP_FRAMES;
	} else if ((input & abstractKeyBMask) && !(lastInput & abstractKeyBMask) && !stun && !usingWeapon) {
		entity.state = EntityState.Startup;
		entity.startupMove = Move._5B;
		entity.framesToStateChange = KIDON_SHOT_B_STARTUP_FRAMES;		
	} else if ((input & abstractKeyUpMask) && !stun) {
		const newVx = entity.vx + safeCosMul(KIDON_ACCEL, entity.angleInt);
		const newVy = entity.vy + safeSinMul(KIDON_ACCEL, entity.angleInt);
		const newNormSq = norm2sq(newVx, newVy);
		if (newNormSq > KIDON_MAX_SPEED * KIDON_MAX_SPEED) {
			const newNorm = safeSqrt(newNormSq);
			const allowedNorm = max(min(newNorm, safeSqrt(norm2sq(entity.vx, entity.vy))), KIDON_MAX_SPEED);
			entity.vx = safeDiv(newVx * allowedNorm, newNorm);
			entity.vy = safeDiv(newVy * allowedNorm, newNorm);
		} else {
			entity.vx = newVx;
			entity.vy = newVy;
		}
			
		if (entity.state === EntityState.Idle || entity.state === EntityState.Moving) {
			entity.state = EntityState.Moving;
			entity.framesToStateChange = FRAMES_TO_IDLE_AFTER_UP + 1; // TODO: If we merge handleEntityKeyboard with handleEntityState, might need to get rid of this +1.
		}
	} else if ((input & abstractKeyDownMask) && !stun) {
		let norm2 = norm2sq(entity.vx, entity.vy);
		if (norm2 < KIDON_ACCEL * KIDON_ACCEL) {
			entity.vx = 0;
			entity.vy = 0;
		} else {
			const angleInt = safeAtan2(entity.vy, entity.vx);
			entity.vx -= safeCosMul(KIDON_ACCEL, angleInt);
			entity.vy -= safeSinMul(KIDON_ACCEL, angleInt);
		}
		
	}

	if ((input & abstractKeyLeftMask) && entity.state !== EntityState.Active) {
		entity.angleInt = normalizeAngle(entity.angleInt + KIDON_TURN_PER_FRAME);
	}
	if ((input & abstractKeyRightMask) && entity.state !== EntityState.Active) {
		entity.angleInt = normalizeAngle(entity.angleInt - KIDON_TURN_PER_FRAME);
	}
		
	if ((input & abstractKeySwitchMask) && !(lastInput & abstractKeySwitchMask)) {
		console.log({input: input, lastInput: lastInput, inputHistory: inputHistory, inputHistoryNextIndex: inputHistoryNextIndex});
		entity.color = entity.color === EntityColor.Red ? EntityColor.Blue : EntityColor.Red;
	}

}

enum Move {
	_5A,
	_5B
}

function activate5A(entity: Entity, addedEntities: Entity[]) {
	const newEntity =
		{type: EntityType.ShotA,
		 hp: 1, // TODO: Is this the right thing to put here?
		 x: entity.x + safeCosMul(safeDiv(KIDON_HEIGHT, 2), entity.angleInt),
		 y: entity.y + safeSinMul(safeDiv(KIDON_HEIGHT, 2), entity.angleInt),
		 vx: safeCosMul(KIDON_SHOT_A_SPEED, entity.angleInt),
		 vy: safeSinMul(KIDON_SHOT_A_SPEED, entity.angleInt),
		 angleInt: entity.angleInt,
		 collisionSide: entity.collisionSide,
		 framesToStateChange: KIDON_SHOT_A_ACTIVE_FRAMES,
		 state: EntityState.Moving,
		 startupMove: null,
		 color: EntityColor.Neutral,
		 shouldBeRemoved: false};		
	entity.framesToStateChange = KIDON_SHOT_A_RECOVERY_FRAMES;
	entity.state = EntityState.Recovery;
	addedEntities.push(newEntity);
}

function activate5B(entity: Entity, addedEntities: Entity[]) {
	const newEntity =
		{type: EntityType.ShotB,
		 hp: 999, // TODO: Is this the right thing to put here?
		 x: entity.x + safeCosMul(safeDiv(KIDON_HEIGHT, 2), entity.angleInt),
		 y: entity.y + safeSinMul(safeDiv(KIDON_HEIGHT, 2), entity.angleInt),
		 vx: 0,
		 vy: 0,
		 angleInt: entity.angleInt,
		 collisionSide: entity.collisionSide,
		 framesToStateChange: KIDON_SHOT_B_ACTIVE_FRAMES,
		 state: EntityState.Moving,
		 startupMove: null,
		 color: entity.color,
		 shouldBeRemoved: false};
	entity.vx = 0;
	entity.vy = 0;
	entity.framesToStateChange = KIDON_SHOT_B_ACTIVE_FRAMES;
	entity.state = EntityState.Active;
	addedEntities.push(newEntity);
}

type ActivationHandler = { (entity: Entity, addedEntities: Entity[]): void; };
const ACTIVATION_HANDLER_MAP = (() => {
	let map = new Map<Move, ActivationHandler>();
	map.set(Move._5A, activate5A);
	map.set(Move._5B, activate5B);
	return map;
})();
for (const value1 in Move) {
	const value1Num = Number(value1);
	if (isNaN(value1Num)) continue;
	if (ACTIVATION_HANDLER_MAP.get(value1Num) == null)
		throw new Error("Missing value in ACTIVATION_HANDLER_MAP");
}
// TODO: Can we merge handleEntityState with handleEntityMovement?
function handleEntityState(entity: Entity, addedEntities: Entity[]) {
	switch (entity.type) {
		case EntityType.Ship:
			if (entity.state !== EntityState.Hitstun) {
				const normSq = norm2sq(entity.vx, entity.vy);
				if (normSq > KIDON_MAX_SPEED * KIDON_MAX_SPEED) {
					const norm = safeSqrt(normSq);
					const newNorm = max(norm - KIDON_STABLIZE_ACCEL, KIDON_MAX_SPEED);
					entity.vx = safeDiv(entity.vx * newNorm, norm);
					entity.vy = safeDiv(entity.vy * newNorm, norm);
					console.log(JSON.stringify({norm: norm, newNorm: newNorm}));
				}
			}
			switch (entity.state) {
				case EntityState.Idle:
					break;
				case EntityState.Recovery:
				case EntityState.Moving:
				case EntityState.Hitstun:
				case EntityState.Blockstun:
					if (--entity.framesToStateChange <= 0)
						entity.state = EntityState.Idle;
					break;
				case EntityState.Startup:
					if (--entity.framesToStateChange <= 0) {
						ACTIVATION_HANDLER_MAP.get(entity.startupMove!)!(entity, addedEntities);
						entity.startupMove = null;
					}
					break;
				case EntityState.Active:
					if (--entity.framesToStateChange <= 0) {
						entity.state = EntityState.Recovery;
						entity.framesToStateChange = KIDON_SHOT_B_RECOVERY_FRAMES;
					}
					break;
				default:
					throw new Error("Unsupported state");
			}
			break;
		case EntityType.ShotA:
		case EntityType.ShotB:
			if (--entity.framesToStateChange <= 0)
				entity.shouldBeRemoved = true;
	}
}

function handleEntityMovement(entity: Entity, player1: Entity, player2: Entity) {
	switch (entity.type) {
		case EntityType.ShotA:
			if (KIDON_SHOT_A_ACTIVE_FRAMES - entity.framesToStateChange < KIDON_SHOT_A_HOMING_FRAMES) {
				const enemy = entity.collisionSide === CollisionSide.PlayerOne ? player2 : player1;
				const desiredAngle = safeAtan2(enemy.y - entity.y, enemy.x - entity.x);
				const diff = angleDiff(desiredAngle, entity.angleInt);
													   
				entity.angleInt = abs(diff) < KIDON_SHOT_A_TURN_PER_FRAME ? desiredAngle :
					diff < 0 ? entity.angleInt - KIDON_SHOT_A_TURN_PER_FRAME
					         : entity.angleInt + KIDON_SHOT_A_TURN_PER_FRAME;
				entity.vx = safeCosMul(KIDON_SHOT_A_SPEED, entity.angleInt);
				entity.vy = safeSinMul(KIDON_SHOT_A_SPEED, entity.angleInt);
			}
			// fallthrough
		case EntityType.ShotB:
		case EntityType.Ship:
			entity.x += entity.vx;
			entity.y += entity.vy;
			break;
		default:
			throw new Error("Unknown entity");
	}
}


interface WallCollisionInfo {
	excessNegativeX: number,
	excessNegativeY: number,
	excessPositiveX: number,
	excessPositiveY: number
}

function getEntityTriangles(type: EntityType) {
	switch (type) {
		case EntityType.Ship:
			return KIDON_TRIANGLES;
		case EntityType.ShotA:
			return KIDON_SHOT_A_TRIANGLES;
		case EntityType.ShotB:
			return KIDON_SHOT_B_TRIANGLES;
		default:
			throw new Error("Unknown entity");			
	}	
}

let gwcPoint: Point = {x: 0, y: 0};
function getWallCollisions(entity: Entity, collisionInfo: WallCollisionInfo): void {
	collisionInfo.excessPositiveY = collisionInfo.excessPositiveX = collisionInfo.excessNegativeY = collisionInfo.excessNegativeX = -WORLD_WIDTH - WORLD_HEIGHT; // TODO: This is for debug
 	let triangles = getEntityTriangles(entity.type);
	// TODO: We can possibly optimize this by only checking external points, but is it
	//       worth it?
	for (let i = 0; i < triangles.length; i += 2) {
		let point = gwcPoint;
		let angle = entity.angleInt;
		point.x = triangles[i];
		point.y = triangles[i+1];
		rotateAndTranslate(point, angle, entity.x, entity.y);

		if (MIN_X - point.x > collisionInfo.excessNegativeX) collisionInfo.excessNegativeX = MIN_X - point.x;
		if (MIN_Y - point.y > collisionInfo.excessNegativeY) collisionInfo.excessNegativeY = MIN_Y - point.y;
		if (point.x - MAX_X > collisionInfo.excessPositiveX) collisionInfo.excessPositiveX = point.x - MAX_X;
		if (point.y - MAX_Y > collisionInfo.excessPositiveY) collisionInfo.excessPositiveY = point.y - MAX_Y;
	}
}

function handleWallCollisions(entity: Entity, wci: WallCollisionInfo) {
	switch (entity.type) {
		case EntityType.Ship:
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
			break;
		case EntityType.ShotA:
		case EntityType.ShotB:
			// TODO: Do nothing for now, in the future we should remove the shots from the game.
			break;
		default:
			throw new Error("handleCollisions does not handle this");
	}
}

// TODO: Lots of the collision related function here should be moved to spatial.ts
function getEntityCoarseRadius(type: EntityType) {
	switch (type) {
		case EntityType.Ship:
			return KIDON_COARSE_RADIUS;
		case EntityType.ShotA:
			return KIDON_SHOT_A_COARSE_RADIUS;
		case EntityType.ShotB:
			return KIDON_SHOT_B_COARSE_RADIUS;
		default:
			throw new Error("getEntityCoarseRadius does not handle this");
	}
}

function coarseCollision(entity1: Entity, entity2: Entity) {
	let r1 = getEntityCoarseRadius(entity1.type);
	let r2 = getEntityCoarseRadius(entity2.type);
	return norm2sq(entity1.x - entity2.x, entity1.y - entity2.y) < (r1 + r2) * (r1 + r2);
}

let fttcPoint1: Point = {x: 0, y: 0};
let fttcPoint2: Point = {x: 0, y: 0};
let fttcPoint3: Point = {x: 0, y: 0};
let fttcPoint4: Point = {x: 0, y: 0};
let fttcPoint5: Point = {x: 0, y: 0};
let fttcPoint6: Point = {x: 0, y: 0};

function isPointInTriangle(pt: Point, pt1: Point, pt2: Point, pt3: Point) {
	// We construct barycentric coordinates with pt1 as (0,0)
	//
	// We want to invert the following matrix:
	//
	//  bx cx
	//  by cy
	//
	// After inversion it becomes:
	//                   +cy -cx   
	// (bxcy-bycx)^-1 *
	//                   -by +bx
	//
	// We want to avoid division so we will accept the upped scale.

	let px = pt.x - pt1.x;
	let py = pt.y - pt1.y;
	let bx = pt2.x - pt1.x;
	let by = pt2.y - pt1.y;
	let cx = pt3.x - pt1.x;
	let cy = pt3.y - pt1.y;
	let d = bx*cy - by*cx;
	let baricentric_x = px * cy - py * cx;
	let baricentric_y = py * bx - px * by;
	if (d > 0) {
		return baricentric_x >= 0 && baricentric_y >= 0 && baricentric_x + baricentric_y <= d;
	} else {	
		return baricentric_x <= 0 && baricentric_y <= 0 && baricentric_x + baricentric_y >= d;	
	}
}

function isLineIntersecting(pt1: Point, pt2: Point, pt3: Point, pt4: Point) {
	// This code is going to be based on https://en.wikipedia.org/wiki/Line%E2%80%93line_intersection#Given_two_points_on_each_line_segment
	// Below is an example that shows how to calculate u.
	//
	// We think of the first line as:
	//
	// pt1 + t(pt2 - pt1)
	//
	//
	// Thus, we are trying to solve:
	// pt1 + t(pt2 - pt1) = pt3 + u(pt4 - pt3)
	//
	//
	// We have two equations now:
	//
	// x1 + t(x2 - x1) = x3 + u(x4 - x3)
	// y1 + t(y2 - y1) = y3 + u(y4 - y3)
	//
	// According to the first line, we get:
	//
	//     (x3 - x1) + u(x4 - x3)     
	// t = ----------------------
	//           (x2 - x1)
	//
	// Let's put in the second one:
	//
	//
	//      (x3 - x1) + u(x4 - x3) 
	// y1 + ----------------------(y2 - y1) = y3 + u(y4 - y3)
	//           (x2 - x1)
	//
	//
	// y1(x2 - x1) + (x3 - x1)(y2 - y1) + u(x4 - x3)(y2 - y1) = y3(x2 - x1) + u(y4 - y3)(x2 - x1)
	//
	// (y1 - y3)(x2 - x1) + (x3 - x1)(y2 - y1) + u(x4 - x3)(y2 - y1) = u(y4 - y3)(x2 - x1)
	//
	// (y1 - y3)(x2 - x1) + (x3 - x1)(y2 - y1) = u((y4 - y3)(x2 - x1) - (x4 - x3)(y2 - y1))
	//
	//
	//     (y1 - y3)(x2 - x1) + (x3 - x1)(y2 - y1)
	// u = ---------------------------------------
    //     (y4 - y3)(x2 - x1) - (x4 - x3)(y2 - y1)
	//
	//     (y1 - y3)(x2 - x1) + (x1 - x3)(y1 - y2)
	// u = ---------------------------------------
    //     (y4 - y3)(x2 - x1) - (x4 - x3)(y2 - y1)
	//
	//     (x1 - x3)(y1 - y2) - (y1 - y3)(x1 - x2) 
	// u = ---------------------------------------
    //     (y4 - y3)(x2 - x1) - (x4 - x3)(y2 - y1)
	//
	//     (x1 - x3)(y1 - y2) - (y1 - y3)(x1 - x2) 
	// u = ---------------------------------------
    //     (y3 - y4)(x1 - x2) - (x4 - x3)(y2 - y1)
	//
	//     (x1 - x3)(y1 - y2) - (y1 - y3)(x1 - x2) 
	// u = ---------------------------------------
    //     (y3 - y4)(x1 - x2) - (x4 - x3)(y2 - y1)


	let x1 = pt1.x, y1 = pt1.y, x2 = pt2.x, y2 = pt2.y, x3 = pt3.x, y3 = pt3.y, x4 = pt4.x, yt4 = pt4.y;
	let x12 = pt1.x - pt2.x;
	let x13 = pt1.x - pt3.x;
	let x34 = pt3.x - pt4.x;
	let y12 = pt1.y - pt2.y;
	let y13 = pt1.y - pt3.y;
	let y34 = pt3.y - pt4.y;
	let t_nom = x13 * y34 - y13 * x34;
	let t_denom = x12 * y34 - y12 * x34;
	let u_nom = x13 * y12 - y13 * x12;
	let u_denom = x12 * y34 - y12 * x34;
	let is_t_good = t_denom > 0 ? (0 <= t_nom && t_nom <= t_denom) : (t_denom <= t_nom && t_nom <= 0);
	let is_u_good = u_denom > 0 ? (0 <= u_nom && u_nom <= u_denom) : (u_denom <= u_nom && u_nom <= 0);
	return is_t_good && is_u_good;
}

function fineTransformedTriangleCollision(triangles1: number[], i1: number, e1x: number, e1y: number, e1a: number,
										  triangles2: number[], i2: number, e2x: number, e2y: number, e2a: number) {
	fttcPoint1.x = triangles1[i1+0];
	fttcPoint1.y = triangles1[i1+1];
	fttcPoint2.x = triangles1[i1+2];
	fttcPoint2.y = triangles1[i1+3];
	fttcPoint3.x = triangles1[i1+4];
	fttcPoint3.y = triangles1[i1+5];
	fttcPoint4.x = triangles2[i2+0];
	fttcPoint4.y = triangles2[i2+1];
	fttcPoint5.x = triangles2[i2+2];
	fttcPoint5.y = triangles2[i2+3];
	fttcPoint6.x = triangles2[i2+4];
	fttcPoint6.y = triangles2[i2+5];
	rotateAndTranslate(fttcPoint1, e1a, e1x, e1y);
	rotateAndTranslate(fttcPoint2, e1a, e1x, e1y);
	rotateAndTranslate(fttcPoint3, e1a, e1x, e1y);
	rotateAndTranslate(fttcPoint4, e2a, e2x, e2y);
	rotateAndTranslate(fttcPoint5, e2a, e2x, e2y);
	rotateAndTranslate(fttcPoint6, e2a, e2x, e2y);

	// See https://stackoverflow.com/questions/2778240/detection-of-triangle-collision-in-2d-space
	return isLineIntersecting(fttcPoint1, fttcPoint2, fttcPoint4, fttcPoint5) ||
		isLineIntersecting(fttcPoint1, fttcPoint2, fttcPoint5, fttcPoint6) ||
		isLineIntersecting(fttcPoint1, fttcPoint2, fttcPoint6, fttcPoint4) ||
		isLineIntersecting(fttcPoint2, fttcPoint3, fttcPoint4, fttcPoint5) ||
		isLineIntersecting(fttcPoint2, fttcPoint3, fttcPoint5, fttcPoint6) ||
		isLineIntersecting(fttcPoint2, fttcPoint3, fttcPoint6, fttcPoint4) ||
		isLineIntersecting(fttcPoint3, fttcPoint1, fttcPoint4, fttcPoint5) ||
		isLineIntersecting(fttcPoint3, fttcPoint1, fttcPoint5, fttcPoint6) ||
		isPointInTriangle(fttcPoint1, fttcPoint4, fttcPoint5, fttcPoint6) ||
		isPointInTriangle(fttcPoint4, fttcPoint1, fttcPoint2, fttcPoint3);
}

function fineCollision(entity1: Entity, entity2: Entity) {
	let triangles1 = getEntityTriangles(entity1.type);
	let triangles2 = getEntityTriangles(entity2.type);

	for (let i1 = 0, l1 = triangles1.length; i1 < l1; i1 += 6) {
		for (let i2 = 0, l2 = triangles2.length; i2 < l2; i2 += 6) {
			if (fineTransformedTriangleCollision(triangles1, i1, entity1.x, entity1.y, entity1.angleInt,
												 triangles2, i2, entity2.x, entity2.y, entity2.angleInt))
				return true;
		}
	}
	return false;
}

function handleShipShipCollision(state: GameState, entity1: Entity, entity2: Entity) {
	// TODO: For now, I assume all objects have the same mass.

	// See https://en.wikipedia.org/wiki/Elastic_collision#Two-dimensional
	let dx = entity1.x - entity2.x;
	let dy = entity1.y - entity2.y
	let dotProd = (entity1.vx - entity2.vx) * dx + (entity1.vy - entity2.vy) * dy;
	let denom = dx * dx + dy * dy;
	let accelX = -safeDiv(dx * dotProd, denom);
	let accelY = -safeDiv(dy * dotProd, denom);
	entity1.vx += accelX;
	entity1.vy += accelY;
	entity2.vx -= accelX;
	entity2.vy -= accelY;


	// TODO: force separation here
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

const IS_DISAPPEAR_ON_HIT_MAP = (() => {
	let map = new Map<EntityType, boolean>();
	map.set(EntityType.ShotB, true);
	map.set(EntityType.ShotA, true);
	map.set(EntityType.Ship, false);
	return map;
})();
for (const value1 in EntityType) {
	const value1Num = Number(value1);
	if (isNaN(value1Num)) continue;
	if (IS_DISAPPEAR_ON_HIT_MAP.get(value1Num) == null)
		throw new Error("Missing value in IS_DISAPPEAR_ON_HIT_MAP");
}

const ACCEL_ON_BLOCK_MAP =
	new Map<EntityType, number>([[EntityType.ShotA, KIDON_SHOT_A_ACCEL_ON_BLOCK],
								 [EntityType.ShotB, KIDON_SHOT_B_ACCEL_ON_BLOCK]])

const ACCEL_ON_HIT_MAP =
	new Map<EntityType, number>([[EntityType.ShotA, KIDON_SHOT_A_ACCEL_ON_HIT],
								 [EntityType.ShotB, KIDON_SHOT_B_ACCEL_ON_HIT]])

const BLOCKSTUN_FRAMES_MAP =
	new Map<EntityType, number>([[EntityType.ShotA, KIDON_SHOT_A_BLOCKSTUN_FRAMES],
								 [EntityType.ShotB, KIDON_SHOT_B_BLOCKSTUN_FRAMES]]);

const HITSTUN_FRAMES_MAP =
	new Map<EntityType, number>([[EntityType.ShotA, KIDON_SHOT_A_HITSTUN_FRAMES],
								 [EntityType.ShotB, KIDON_SHOT_B_HITSTUN_FRAMES]]);

const BLOCKED_DAMAGE_MAP =
	new Map<EntityType, number>([[EntityType.ShotA, KIDON_SHOT_A_BLOCKED_DAMAGE],
								 [EntityType.ShotB, KIDON_SHOT_B_BLOCKED_DAMAGE]]);

const HIT_DAMAGE_MAP =
	new Map<EntityType, number>([[EntityType.ShotA, KIDON_SHOT_A_HIT_DAMAGE],
								 [EntityType.ShotB, KIDON_SHOT_B_HIT_DAMAGE]]);

const SHOT_DISAPPEARS_ON_IMPACT_MAP =
	new Map<EntityType, boolean>([[EntityType.ShotA, true],
								  [EntityType.ShotB, false]]);

function handleShipShotCollision(state: GameState, ship: Entity, shot: Entity) {
	const angle = shot.angleInt;
	const isBlocked = (ship.state == EntityState.Idle || ship.state === EntityState.Blockstun) && (shot.color === ship.color || shot.color === EntityColor.Neutral) && false;
	const accelOnBlock = ACCEL_ON_BLOCK_MAP.get(shot.type)!;
	const dvx = safeCosMul(isBlocked ? ACCEL_ON_BLOCK_MAP.get(shot.type)! : ACCEL_ON_HIT_MAP.get(shot.type)!, angle);
	const dvy = safeSinMul(isBlocked ? ACCEL_ON_BLOCK_MAP.get(shot.type)! : ACCEL_ON_HIT_MAP.get(shot.type)!, angle);
	if (!isBlocked && ship.state !== EntityState.Hitstun) {
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
	if (SHOT_DISAPPEARS_ON_IMPACT_MAP.get(shot.type))
		shot.shouldBeRemoved = true;
	else
		shot.collisionSide = CollisionSide.None;
	ship.state = isBlocked ? EntityState.Blockstun : EntityState.Hitstun;
	ship.framesToStateChange = isBlocked ? BLOCKSTUN_FRAMES_MAP.get(shot.type)! : HITSTUN_FRAMES_MAP.get(shot.type)!;
	ship.hp -= isBlocked ? BLOCKED_DAMAGE_MAP.get(shot.type)! : HIT_DAMAGE_MAP.get(shot.type)!;
}

function handleShotAShotACollision(state: GameState, e1: Entity, e2: Entity) {
	e1.shouldBeRemoved = true;
	e2.shouldBeRemoved = true;
}

function handleShotAShotBCollision(state: GameState, shotA: Entity, shotB: Entity) {
	shotA.shouldBeRemoved = true;
}

type CollisionHandler = { (state: GameState, x: Entity, y: Entity): void; };
const COLLISION_HANDLER_MAP = (() => {
	let map = new Map<EntityType, Map<EntityType, CollisionHandler>>();
	let shipMap = new Map<EntityType, CollisionHandler>();
	shipMap.set(EntityType.Ship, handleShipShipCollision);
	shipMap.set(EntityType.ShotA, handleShipShotCollision);
	shipMap.set(EntityType.ShotB, handleShipShotCollision);
	map.set(EntityType.Ship, shipMap);
	let shotAMap = new Map<EntityType, CollisionHandler>();
	shotAMap.set(EntityType.ShotA, handleShotAShotACollision);
	shotAMap.set(EntityType.ShotB, handleShotAShotBCollision);
	map.set(EntityType.ShotA, shotAMap);
	let shotBMap = new Map<EntityType, CollisionHandler>();
	shotBMap.set(EntityType.ShotB, handleShotAShotACollision);
	map.set(EntityType.ShotB, shotBMap);
	return map;
})();
for (const value1 in EntityType) {
	const value1Num = Number(value1);
	if (isNaN(value1Num)) continue;
	for (const value2 in EntityType) {
		const value2Num = Number(value2);
		if (isNaN(value2Num)) continue;
		if (value1 <= value2 && COLLISION_HANDLER_MAP.get(value1Num)!.get(value2Num) == null)
			throw new Error("Missing collision handler function");
		else if (value1 > value2 && COLLISION_HANDLER_MAP.get(value1Num)!.get(value2Num) != null)
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
	let wci = {excessPositiveY: 0, excessPositiveX: 0, excessNegativeY: 0, excessNegativeX: 0};
	getWallCollisions(entity, wci);
	handleWallCollisions(entity, wci);
	getAndHandleEntityCollisions(entity_i, state);
}

function initialEntities() {
	return [{type: EntityType.Ship,
			 hp: KIDON_MAX_HP,
			 x: PLAYER1_START_X,
			 y: PLAYER1_START_Y,
			 vx: 0,
			 vy: 0,
			 angleInt: 0,
			 collisionSide: CollisionSide.PlayerOne,
			 state: EntityState.Idle,
			 startupMove: null,
			 framesToStateChange: 0,
			 color: EntityColor.Red,
			 shouldBeRemoved: false},
			{type: EntityType.Ship,
			 hp: KIDON_MAX_HP,
			 x: PLAYER2_START_X,
			 y: PLAYER2_START_Y,
			 vx: 0,
			 vy: 0,
			 angleInt: 0,
			 collisionSide: CollisionSide.PlayerTwo,
			 state: EntityState.Idle,
			 startupMove: null,
			 framesToStateChange: 0,
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
							player1InputHistory: [],
							player1InputHistoryNextIndex: -999,
							player2InputHistory: [],
							player2InputHistoryNextIndex: -999,
							player1CurrentComboHits: -999,
							player2CurrentComboHits: -999,
							winScreen: WinScreen.Draw,
							winScreenRemainingFrames: -999};
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

export function getMaxHp(type: EntityType) {
	if (type === EntityType.Ship)
		return KIDON_MAX_HP;
	throw new Error("getMaxHp for unknown");
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
	let pt1 = {x: KIDON_TRIANGLES[0], y: KIDON_TRIANGLES[1]};
	let pt2 = {x: KIDON_TRIANGLES[2], y: KIDON_TRIANGLES[3]};
	let pt3 = {x: KIDON_TRIANGLES[4], y: KIDON_TRIANGLES[5]};
	let pt4 = {x: KIDON_TRIANGLES[0], y: KIDON_TRIANGLES[1]};
	let pt5 = {x: KIDON_TRIANGLES[2], y: KIDON_TRIANGLES[3]};
	let pt6 = {x: KIDON_TRIANGLES[4], y: KIDON_TRIANGLES[5]};
	
	handleEntityKeyboard(state.entities[PLAYER1_INDEX], inputs[0], state.player1InputHistory, state.player1InputHistoryNextIndex);
	handleEntityKeyboard(state.entities[PLAYER2_INDEX], inputs[1], state.player2InputHistory, state.player2InputHistoryNextIndex);

	let addedEntities: Entity[] = [];
	for (let i = 0, l = state.entities.length; i < l; ++i)
		handleEntityState(state.entities[i], addedEntities);

	updateInputHistory(state, inputs);
	for (let i = 0, l = addedEntities.length; i < l; ++i) state.entities.push(addedEntities[i]);
	removeEntities(state);

	if (state.entities[PLAYER1_INDEX].hp <= 0) {
		state.winScreen = state.entities[PLAYER2_INDEX].hp <= 0 ? WinScreen.Draw : WinScreen.Player1;
		state.winScreenRemainingFrames = WIN_SCREEN_FRAMES;
	} else if (state.entities[PLAYER2_INDEX].hp <= 0) {
		state.winScreen = WinScreen.Player2;
		state.winScreenRemainingFrames = WIN_SCREEN_FRAMES;
	}
}
