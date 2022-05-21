import { Entity } from './Entity';
import { Move } from './Move';
import { ActivationHandler } from './ActivationHandler';

export type TryStartupHandler = { (entity_i: number, entities: Entity[], move: Move, info: MoveInfo): boolean; };

export interface MoveInfo {
	startupFrames: number,
	recoveryFrames: number,
	battCost: number,
	warpCost: number,
	canCancel: boolean
	onTryStartup: TryStartupHandler,
	onActivation: ActivationHandler,
}
