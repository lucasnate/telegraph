import { assert } from '../../src/util/assert';
import { hash } from './util/hash';
import deterministicStringify from 'fast-json-stable-stringify';

export function abs(x: number): number {
	return Math.abs(x);
}

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

export function normalizeAngle(x: number) {
	x %= MAX_INT_ANGLE;
	if (x < 0)
		x += MAX_INT_ANGLE;
	return x;
}

export function angleDiff(x: number, y: number) {
	let diff = x - y;
	diff = normalizeAngle(diff);
	if (diff > safeDiv(MAX_INT_ANGLE, 2))
		diff -= MAX_INT_ANGLE;
	return diff;
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
	if (x === 0) return y > 0 ? +MAX_INT_ANGLE / 4 : -MAX_INT_ANGLE / 4;
	if (y === 0) return x > 0 ? 0                  : +MAX_INT_ANGLE / 2;
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

export interface MulberryState {
	mulberryState: number
}

function mulberry32(state: MulberryState) {
    var t = state.mulberryState += 0x6D2B79F5;
    t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0);
}

export function rand(state: MulberryState, min: number, max: number): number {
	let x = mulberry32(state);
	x = x % (max - min + 1);
	x += min;
	return x;
}

export function norm2sq(x: number,y: number): number {
	return x*x + y*y;
}

export function arithSeriesSum(first: number, last: number, diff: number) {
	const n = (last - first) % diff === 0
		? safeDiv(last - first, diff)
		: safeDiv(last - first, diff) + 1;
	if (n <= 0) { return 0; }	
	return safeDiv((first + (first + diff * (n - 1))) * n, 2);
}
