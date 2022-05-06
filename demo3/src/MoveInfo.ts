import { ActivationHandler } from './ActivationHandler';

export interface MoveInfo {
	startupFrames: number,
	recoveryFrames: number,
	battCost: number,
	handler: ActivationHandler,
}
