import { assert } from '../../src/util/assert';
import { hash } from './util/hash';
import deterministicStringify from 'fast-json-stable-stringify';

export function max(x: number, y: number): number {
	return Math.max(x, y);
}

export function min(x: number, y: number): number {
	return Math.min(x, y);
}

export function safeDiv(x: number, y: number): number {
	return Math.floor(x / y);
}

export function safeSqrt(x: number): number {
	return Math.floor(Math.sqrt(x));
}

export const MAX_INT_ANGLE = 1024;
export const ANGLE_TRIGO_MULTIPLIER = 16384;

const safeSinMultiplied: number[] = [];
for (let angleInt = 0; angleInt < MAX_INT_ANGLE; ++angleInt)
	safeSinMultiplied[angleInt] = Math.floor(Math.sin(angleInt * 2 * Math.PI / MAX_INT_ANGLE) * ANGLE_TRIGO_MULTIPLIER);
assert(hash(deterministicStringify(safeSinMultiplied)) === '7c67944b2681e6dafc18ca245ec38f73', "Failed to build sinus table, hash is " + hash(deterministicStringify(safeSinMultiplied)));

const safeAtan: number[] = []
for (let fraction = 0; fraction <= ANGLE_TRIGO_MULTIPLIER; ++fraction) {
	safeAtan[fraction] = Math.floor(Math.atan(fraction / ANGLE_TRIGO_MULTIPLIER) * MAX_INT_ANGLE / (2 * Math.PI));
}
assert(hash(deterministicStringify(safeAtan)) === 'e724ba0f70454b0b6886b2bc5380e8ac', "Failed to build atan table, hash is " + hash(deterministicStringify(safeAtan)));

export function safeSinMul(factor: number, angleInt: number) {
	if (angleInt < 0)
		return -safeSinMulPositive(factor, -angleInt);
	else
		return safeSinMulPositive(factor, angleInt);	
}

function safeSinMulPositive(factor: number, angleIntPositive: number): number {
	angleIntPositive = angleIntPositive % MAX_INT_ANGLE;
	return safeDiv(safeSinMultiplied[angleIntPositive] * factor, ANGLE_TRIGO_MULTIPLIER);
}

export function safeCosMul(factor: number, angleInt: number): number {
	return safeSinMul(factor, MAX_INT_ANGLE / 4 - angleInt);
}

function safeAtan2Positive(y: number, x: number): number {
	if (x > y) {
		return safeAtan[safeDiv(y * ANGLE_TRIGO_MULTIPLIER, x)];
	} else {
		return MAX_INT_ANGLE / 4 - safeAtan[safeDiv(x * ANGLE_TRIGO_MULTIPLIER, y)];
	}

}

export function safeAtan2(y: number, x: number): number {
	if (x >= 0 && y >= 0) {
		return safeAtan2Positive(y, x);
	} else if (x < 0 && y >= 0) {
		return MAX_INT_ANGLE / 2 - safeAtan2Positive(y, -x);
	} else if (x < 0 && y < 0) {
		return safeAtan2Positive(-y, -x) + MAX_INT_ANGLE / 2;
	} else if (x >= 0 && y < 0) {
		return MAX_INT_ANGLE - safeAtan2Positive(-y, x);		
	}
	assert(false, "safeAtan2 - got impossible path");
	return 0;
}

