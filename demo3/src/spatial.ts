// TODO: This file needs to have float protection

import { assert } from '../../src/util/assert';
import { safeSqrt } from './safeCalc';
import { safeCosMul, safeSinMul } from './safeCalc';

interface CenteredSquare {
	minxy: number;
	maxxy: number;
}

export interface Point {
	x: number;
	y: number;
}

export function rotateAndTranslate(point: Point, angle: number, offsetx: number, offsety: number) {
	let newx = safeCosMul(point.x, angle) - safeSinMul(point.y, angle) + offsetx;
	let newy = safeSinMul(point.x, angle) + safeCosMul(point.y, angle) + offsety; 
	point.x = newx;
	point.y = newy;
}
export function getCoarseSquare(triangles: number[]): CenteredSquare {
	const max_d = getCoarseRadius(triangles);
	return {minxy: -max_d, maxxy: +max_d};
}

export function getCoarseRadius(triangles: number[]): number {
	assert(triangles.length % 2 === 0, "getRotationIndependentBoundingRect - premature EOF");
	let max_d_sq = 0;
	for (let i = 0; i < triangles.length; i += 2) {
		const x = triangles[i], y = triangles[i + 1];
		const d_sq = x * x + y * y;
		if (d_sq > max_d_sq)
			max_d_sq = d_sq;
	}
	return safeSqrt(max_d_sq);
}
