import { Entity, EntityType, EntityColor, EntityState, CollisionSide } from './Entity';
import { safeDiv, safeCosMul, safeSinMul, abs, angleDiff, safeAtan2, norm2sq, safeSqrt, max, min } from './safeCalc';
import { assert } from '../../src/util/assert';
import { shipInfos } from './shipInfos';
import { Move } from './Move';
import { MoveInfo } from './MoveInfo';
import { Renderable, RenderableType } from './Renderable';

export const PLAYER1_INDEX = 0;
export const PLAYER2_INDEX = 1;

const WARP_AFTER_IMAGE_SPAWN_FRAMES = 5;
export const WARP_AFTER_IMAGE_TTL_FRAMES = 30;

export function turnToWantedAngle(src: Entity, dest: Entity, maxTurn: number) {
    const desiredAngle = safeAtan2(dest.y - src.y, dest.x - src.x);
    const diff = angleDiff(desiredAngle, src.angleInt);    
    src.angleInt = abs(diff) < maxTurn ? desiredAngle :
                   diff < 0            ? src.angleInt - maxTurn
                                       : src.angleInt + maxTurn;
}

export function activateShotWithoutRecovery(entity_i: number, entities: Entity[], shotType: EntityType, speed: number, activeFrames: number, color: EntityColor, fwdOffset: number) {
	const entity = entities[entity_i];
	const angle = entity.angleInt;
	const newEntity =
		{type: shotType,
		 hp: 1, // TODO: Is this the right thing to put here?
		 batt: 1, // TODO: Is this the right thing to put here?
		 warp: 1, // TODO: Is this the right thing to put here?
		 x: entity.x + safeCosMul(fwdOffset, angle),
		 y: entity.y + safeSinMul(fwdOffset, angle),
		 vx: safeCosMul(speed, entity.angleInt),
		 vy: safeSinMul(speed, entity.angleInt),
		 preWarpVx: 0,
		 preWarpVy: 0,
		 angleInt: angle,
		 scaleWidthPct: 100,
		 scaleHeightPct: 100,		 
		 collisionSide: entity.collisionSide,
		 framesToStateChange: activeFrames,
		 noStablizeFrames: 0,
		 stateDoNotTouchDirectly: EntityState.Moving,
		 startupMove: null,
		 color: color,
		 shouldBeRemoved: false};		
	entities.push(newEntity);
	return newEntity;
}	

export function activateShot(entity_i: number, entities: Entity[], shotType: EntityType, speed: number, activeFrames: number, recoveryFrames: number, hasColor: EntityColor, fwdOffset: number): Entity {
	const entity = entities[entity_i];
	setEntityState(entity, EntityState.Recovery, recoveryFrames);
	return activateShotWithoutRecovery(entity_i, entities, shotType, speed, activeFrames, hasColor, fwdOffset);
}

export function activateGuidedLaser(entity_i: number, entities: Entity[], shotType: EntityType, activeFrames: number, turn: number, unblockable: boolean, fwdOffset: number) {
	assert(entity_i === PLAYER1_INDEX || entity_i === PLAYER2_INDEX,
		   "Weird entity_i");
	const entity = entities[entity_i];
	const enemy = entities[entity_i === PLAYER1_INDEX ? PLAYER2_INDEX : PLAYER1_INDEX];
	const newEntity =
		{type: shotType,
		 hp: 999, // TODO: Is this the right thing to put here?
		 batt: 999, // TODO: Is this the right thing to put here?
		 warp: 999, // TODO: Is this the right thing to put here?
		 x: entity.x + safeCosMul(fwdOffset, entity.angleInt),
		 y: entity.y + safeSinMul(fwdOffset, entity.angleInt),
		 vx: 0,
		 vy: 0,
		 preWarpVx: 0,
		 preWarpVy: 0,
		 angleInt: entity.angleInt,
		 scaleWidthPct: 100,
		 scaleHeightPct: 100,
		 collisionSide: entity.collisionSide,
		 framesToStateChange: activeFrames,
		 noStablizeFrames: 0,
		 stateDoNotTouchDirectly: EntityState.Moving,
		 startupMove: null,
		 color: unblockable ? EntityColor.Purple : entity.color,
		 shouldBeRemoved: false};
	// entity.vx = 0;
	// entity.vy = 0;
	setEntityState(entity, EntityState.Active, activeFrames);
	turnToWantedAngle(newEntity, enemy, turn)
	entities.push(newEntity);
}

export function setEntityState(entity: Entity, newState: EntityState, framesToStateChange: number) {
	disableShipWarp(entity);
	if ((entity.stateDoNotTouchDirectly === EntityState.Blockstun || entity.stateDoNotTouchDirectly === EntityState.Hitstun) &&
		(newState !== EntityState.Blockstun && newState !== EntityState.Hitstun))
	{
		entity.noStablizeFrames = shipInfos.get(entity.type)!.noStablizeFrames;
	}
	entity.stateDoNotTouchDirectly = newState;
	entity.framesToStateChange = framesToStateChange;
}

export function getEntityState(entity: Entity) {
	return entity.stateDoNotTouchDirectly;
}

export function disableShipWarp(entity: Entity) {
	if (entity.stateDoNotTouchDirectly !== EntityState.Warp)
		return;

	entity.vx = entity.preWarpVx;
	entity.vy = entity.preWarpVy;
	entity.stateDoNotTouchDirectly = EntityState.Idle;
	entity.framesToStateChange = 0;
}

export const SHIP_LIST: EntityType[] = [];
export const SHIP_SET: Set<EntityType> = new Set();
export function isShip(type: EntityType): boolean {
	return SHIP_SET.has(type);
}

export function handleHomingShotState(entity_i: number, entities: Entity[], activeFrames: number, homingFrames: number, turnPerFrame: number, speed: number) {
	const entity = entities[entity_i];
	const player1 = entities[PLAYER1_INDEX];
	const player2 = entities[PLAYER2_INDEX];
	if (activeFrames - entity.framesToStateChange < homingFrames) {
		const enemy = entity.collisionSide === CollisionSide.PlayerOne ? player2 : player1;
		turnToWantedAngle(entity, enemy, turnPerFrame);
		entity.vx = safeCosMul(speed, entity.angleInt);
		entity.vy = safeSinMul(speed, entity.angleInt);
	}
	if (--entity.framesToStateChange <= 0)
		entity.shouldBeRemoved = true;	
}

export function doEntityAccel(entity: Entity, accel: number, maxSpeed: number) {
	const newVx = entity.vx + safeCosMul(accel, entity.angleInt);
	const newVy = entity.vy + safeSinMul(accel, entity.angleInt);
	const newNormSq = norm2sq(newVx, newVy);
	if (newNormSq > maxSpeed * maxSpeed) {
		const newNorm = safeSqrt(newNormSq);
		const allowedNorm = max(min(newNorm, safeSqrt(norm2sq(entity.vx, entity.vy))), maxSpeed);
		entity.vx = safeDiv(newVx * allowedNorm, newNorm);
		entity.vy = safeDiv(newVy * allowedNorm, newNorm);
	} else {
		entity.vx = newVx;
		entity.vy = newVy;
	}
}

export function tryStartupWeapon(entity_i: number, entities: Entity[], move: Move, info: MoveInfo): boolean {
	// Note that at the time of writing (2022-05-22) startupFrames == 1 means something
	// starts immediately.
	assert(info.startupFrames > 0, "tryStartupWeapon called with non-positive frame count");
	const entity = entities[entity_i];
	if (entity.batt < info.battCost)
		return false;
	if (info.warpCost > 0 && entity.warp < shipInfos.get(entity.type)!.maxWarp)
		return false;
	
	entity.batt -= info.battCost;
	entity.warp -= info.warpCost;
	
	setEntityState(entity, EntityState.Startup, info.startupFrames);
	entity.startupMove = move;
	return true;
}

const ENTITY_TO_RENDERABLE_MAP = new Map<EntityType, RenderableType>([
	[EntityType.KidonShip, RenderableType.KidonWarpAfterImage],
	[EntityType.AyinHelperB1, RenderableType.AyinHelperB1WarpAfterImage]
]);
	
export function renderEntityWarp(entity: Entity, renderables: Renderable[]) {
	const renderableType = ENTITY_TO_RENDERABLE_MAP.get(entity.type)!;
	if (renderableType == null)
		throw new Error("renderEntityWarp called on unsupported entity type: " + entity.type.toString());
	
	if (entity.framesToStateChange % WARP_AFTER_IMAGE_SPAWN_FRAMES === 0) {
		const renderable = {
			type: renderableType,
			x: entity.x,
			y: entity.y,
			angleInt: entity.angleInt,
			vx: 0,
			vy: 0,
			ax: 0,
			ay: 0,
			remainingFrames: WARP_AFTER_IMAGE_TTL_FRAMES,
			totalFrames: WARP_AFTER_IMAGE_TTL_FRAMES,
			sizePct: 100
		};
		renderables.push(renderable);
	}	
}

export function isUsingMove(state: EntityState) {
	return state === EntityState.Startup || state === EntityState.Active || state === EntityState.Recovery;
}
