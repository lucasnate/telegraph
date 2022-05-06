import { Entity, EntityType, EntityColor, EntityState, CollisionSide } from './Entity';
import { safeDiv, safeCosMul, safeSinMul, abs, angleDiff, safeAtan2 } from './safeCalc';
import { assert } from '../../src/util/assert';
import { shipInfos } from './shipInfos';

export const PLAYER1_INDEX = 0;
export const PLAYER2_INDEX = 1;

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

export function activateLaser(entity_i: number, entities: Entity[], shotType: EntityType, activeFrames: number, turn: number, unblockable: boolean, fwdOffset: number) {
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

	assert(isShip(entity.type), "unsupported type for warp disabling");

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

export function handleHomingShotMovement(entity: Entity, player1: Entity, player2: Entity, activeFrames: number, homingFrames: number, turnPerFrame: number, speed: number) {
	if (activeFrames - entity.framesToStateChange < homingFrames) {
		const enemy = entity.collisionSide === CollisionSide.PlayerOne ? player2 : player1;
		turnToWantedAngle(entity, enemy, turnPerFrame);
		entity.vx = safeCosMul(speed, entity.angleInt);
		entity.vy = safeSinMul(speed, entity.angleInt);
	}
	entity.x += entity.vx;
	entity.y += entity.vy;
}
