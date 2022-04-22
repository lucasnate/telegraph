import { Entity } from './Entity';

export type ActivationHandler = { (entity_i: number, entities: Entity[]): void; };
