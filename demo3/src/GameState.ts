// TODO: This file needs to have float protection

import { SyncData, InputValues } from '../../src/types';
import { RingBuffer } from '../../src/util/RingBuffer';
import { safeDiv, safeSqrt, MAX_INT_ANGLE, safeCosMul, safeSinMul, safeAtan2 } from './safeCalc';
import { abstractKeyUpMask, abstractKeyLeftMask, abstractKeyRightMask, abstractKeyDownMask, abstractKeySwitchMask } from './Inputter';

import { KIDON_WIDTH, KIDON_HEIGHT, KIDON_TRIANGLES, KIDON_COARSE_RADIUS } from './shipShapes';
import { Point, rotateAndTranslate } from './spatial';

// TODO: Need to get these things through syncData
export const WORLD_WIDTH = 100000;
export const WORLD_HEIGHT = 100000;
export const KIDON_MAX_SPEED = safeDiv(KIDON_HEIGHT, 10);
export const KIDON_FULL_ACCEL_FRAMES = 20;
export const KIDON_ACCEL = safeDiv(KIDON_MAX_SPEED, KIDON_FULL_ACCEL_FRAMES);
export const KIDON_FULL_TURN_FRAMES = 60;
export const KIDON_TURN_PER_FRAME = safeDiv(MAX_INT_ANGLE, KIDON_FULL_TURN_FRAMES);

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

let FRAMES_TO_IDLE_AFTER_UP = 5;

export interface GameSyncData extends SyncData {}

export enum EntityType {
	Ship,
	Shot
}

enum CollisionSide {
	PlayerOne,
	PlayerTwo
}

export enum EntityState {
	Idle,
	Moving
}

export enum EntityColor {
	Red, Blue
}

export interface Entity {
	type: EntityType,
	x: number,
	y: number,
	vx: number,
	vy: number,
	angleInt: number,
	collisionSide: CollisionSide,

	state: EntityState,
	framesToIdle: number,

	color: EntityColor
}

export interface GameState {
	entities: Entity[],
	player1InputHistory: RingBuffer<number>,
	player2InputHistory: RingBuffer<number>
}

function norm2sq(x: number,y: number): number {
	return x*x + y*y;
}

function handleEntityKeyboard(entity: Entity, input: number) {
	if (input & abstractKeyUpMask) {
		entity.vx += safeCosMul(KIDON_ACCEL, entity.angleInt);
		entity.vy += safeSinMul(KIDON_ACCEL, entity.angleInt);
		if (norm2sq(entity.vx, entity.vy) > KIDON_MAX_SPEED * KIDON_MAX_SPEED) {
			const angleInt = safeAtan2(entity.vy, entity.vx);
			entity.vx = safeCosMul(KIDON_MAX_SPEED, angleInt);
			entity.vy = safeSinMul(KIDON_MAX_SPEED, angleInt);
		}
		entity.state = EntityState.Moving;
		entity.framesToIdle = FRAMES_TO_IDLE_AFTER_UP;
	} else if (input & abstractKeyDownMask) {
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

	if (input & abstractKeyLeftMask) {
		entity.angleInt += KIDON_TURN_PER_FRAME;
	}
	if (input & abstractKeyRightMask) {
		entity.angleInt -= KIDON_TURN_PER_FRAME;
	}

	if (input & abstractKeySwitchMask) {
		entity.color = entity.color === EntityColor.Red ? EntityColor.Blue : EntityColor.Red;
	}
}

function handleEntityState(entity: Entity) {
	switch (entity.state) {
		case EntityState.Idle:
			break;
		case EntityState.Moving:
			if (--entity.framesToIdle <= 0)
				entity.state = EntityState.Idle;
			break;
		default:
			throw new Error("Unsupported state");
	}
}

function handleEntityMovement(entity: Entity) {
	switch (entity.type) {
		case EntityType.Ship:
			entity.x += entity.vx;
			entity.y += entity.vy;
			break;
		case EntityType.Shot:
			throw new Error("Shot not supported yet");
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
		case EntityType.Shot:
			throw new Error("Shot not supported yet");
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
		default:
			throw new Error("handleCollisions does not handle this");
	}
}

// TODO: Lots of the collision related function here should be moved to spatial.ts
function getEntityCoarseRadius(type: EntityType) {
	switch (type) {
		case EntityType.Ship:
			return KIDON_COARSE_RADIUS;
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

function handleShipShipCollision(entity1: Entity, entity2: Entity) {
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

function handleEntityPairCollision(entity1: Entity, entity2: Entity) {
	if (entity1.type === EntityType.Ship && entity2.type === EntityType.Ship) {
		handleShipShipCollision(entity1, entity2);
	} else {
		throw new Error("Can't handle this collision: " + JSON.stringify([entity1, entity2]));
	}
}

function getAndHandleEntityCollisions(entity_i: number, entities: Entity[]) {
	let entity = entities[entity_i];
	for (let i = entity_i, l = entities.length; i < l; ++i) {
		let otherEntity = entities[i];
		if (entity.collisionSide === otherEntity.collisionSide) // TODO: Should probably have a way to filter these in advance.
			continue;
		if (!coarseCollision(entity, otherEntity))
			continue;

		if (!fineCollision(entity, otherEntity))
			continue;

		handleEntityPairCollision(entity, otherEntity);
	}
}

function handleCollisions(entity_i: number, entities: Entity[]) {
	let entity = entities[entity_i];
	let wci = {excessPositiveY: 0, excessPositiveX: 0, excessNegativeY: 0, excessNegativeX: 0};
	getWallCollisions(entity, wci);
	handleWallCollisions(entity, wci);
	getAndHandleEntityCollisions(entity_i, entities);
}

export function createGameState(): GameState {
	let player1InputHistory = new RingBuffer<number>(256);
	let player2InputHistory = new RingBuffer<number>(256);
	while (!player1InputHistory.isFull()) player1InputHistory.push(0);
	while (!player2InputHistory.isFull()) player2InputHistory.push(0);
	return {entities: [{type: EntityType.Ship,
						x: PLAYER1_START_X,
						y: PLAYER1_START_Y,
						vx: 0,
						vy: 0,
						angleInt: 0,
						collisionSide: CollisionSide.PlayerOne,
						framesToIdle: 0,
						state: EntityState.Idle,
						color: EntityColor.Red},
					   {type: EntityType.Ship,
						x: PLAYER2_START_X,
						y: PLAYER2_START_Y,
						vx: 0,
						vy: 0,
						angleInt: 0,
						collisionSide: CollisionSide.PlayerTwo,
						framesToIdle: 0,
						state: EntityState.Idle,
						color: EntityColor.Red}],
			player1InputHistory: player1InputHistory,
			player2InputHistory: player2InputHistory};
}

function updateInputHistory(state: GameState, inputs: number[]) {
	state.player1InputHistory.pop();
	state.player2InputHistory.pop();
	state.player1InputHistory.push(inputs[0]);
	state.player2InputHistory.push(inputs[1]);
}

export function updateGameState(state: GameState, inputs: number[], winningSyncData: GameSyncData): void {
	for (let i = 0, l = state.entities.length; i < l; ++i) {
		handleEntityMovement(state.entities[i]);
		handleCollisions(i, state.entities);
	}
	let pt1 = {x: KIDON_TRIANGLES[0], y: KIDON_TRIANGLES[1]};
	let pt2 = {x: KIDON_TRIANGLES[2], y: KIDON_TRIANGLES[3]};
	let pt3 = {x: KIDON_TRIANGLES[4], y: KIDON_TRIANGLES[5]};
	let pt4 = {x: KIDON_TRIANGLES[0], y: KIDON_TRIANGLES[1]};
	let pt5 = {x: KIDON_TRIANGLES[2], y: KIDON_TRIANGLES[3]};
	let pt6 = {x: KIDON_TRIANGLES[4], y: KIDON_TRIANGLES[5]};
	
	handleEntityKeyboard(state.entities[PLAYER1_INDEX], inputs[0]);
	handleEntityKeyboard(state.entities[PLAYER2_INDEX], inputs[1]);
	handleEntityState(state.entities[PLAYER1_INDEX]);
	handleEntityState(state.entities[PLAYER2_INDEX]);

	updateInputHistory(state, inputs);
}
