import { Move } from './Move';


export enum EntityType {
	KidonShip,
	KidonShotA1,
	KidonShotA2,
	KidonShotB1,
	KidonShotB2,
	KidonShotC1Big,
	KidonShotC1Small,
	KidonShotC2Big,
	KidonShotC2Small,

	AyinShip,
}

export enum CollisionSide {
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
	Warp,
}

export enum EntityColor {
	Red, Blue, Neutral, Purple
}

export interface Entity {
	type: EntityType,
	hp: number,
	batt: number,
	warp: number,
	x: number,
	y: number,
	vx: number,
	vy: number,
	preWarpVx: number,
	preWarpVy: number,
	angleInt: number,
	collisionSide: CollisionSide,

	stateDoNotTouchDirectly: EntityState,
	startupMove: Move | null,
	framesToStateChange: number,
	noStablizeFrames: number,

	color: EntityColor,

	shouldBeRemoved: boolean
}

