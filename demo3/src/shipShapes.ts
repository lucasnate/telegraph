// TODO: This file needs to have float protection

import { safeDiv, MAX_INT_ANGLE } from './safeCalc';
import { getCoarseSquare, getCoarseRadius, Point, rotateAndTranslate } from './spatial';

export const KIDON_WIDTH = 3500;
export const KIDON_HEIGHT = 3500;

const KIDON_BIG_TRIANGLE = [
	safeDiv(KIDON_WIDTH * -2, 10), safeDiv(KIDON_HEIGHT * -3, 6),
	safeDiv(KIDON_WIDTH * +2, 10), safeDiv(KIDON_HEIGHT * -3, 6),
	safeDiv(KIDON_WIDTH * +0, 10), safeDiv(KIDON_HEIGHT * +3, 6),
];
const KIDON_SMALL_TRIANGLE1 = [
	safeDiv(KIDON_WIDTH * -5, 10), safeDiv(KIDON_HEIGHT * -1, 6),
	safeDiv(KIDON_WIDTH * -3, 10), safeDiv(KIDON_HEIGHT * -1, 6),		
	safeDiv(KIDON_WIDTH * -4, 10), safeDiv(KIDON_HEIGHT * +1, 6),		
];
const KIDON_SMALL_TRIANGLE2 = [
	safeDiv(KIDON_WIDTH * +3, 10), safeDiv(KIDON_HEIGHT * -1, 6),
	safeDiv(KIDON_WIDTH * +5, 10), safeDiv(KIDON_HEIGHT * -1, 6),		
	safeDiv(KIDON_WIDTH * +4, 10), safeDiv(KIDON_HEIGHT * +1, 6),					
];
const KIDON_CONNECTOR_TRIANGLE1 = [
	KIDON_SMALL_TRIANGLE1[4] + safeDiv((KIDON_SMALL_TRIANGLE1[2] - KIDON_SMALL_TRIANGLE1[4]) * 3, 6), KIDON_SMALL_TRIANGLE1[5] + safeDiv((KIDON_SMALL_TRIANGLE1[3] - KIDON_SMALL_TRIANGLE1[5]) * 3, 6), 
	KIDON_SMALL_TRIANGLE1[4] + safeDiv((KIDON_SMALL_TRIANGLE1[2] - KIDON_SMALL_TRIANGLE1[4]) * 4, 6), KIDON_SMALL_TRIANGLE1[5] + safeDiv((KIDON_SMALL_TRIANGLE1[3] - KIDON_SMALL_TRIANGLE1[5]) * 4, 6), 
	KIDON_SMALL_TRIANGLE2[4] + safeDiv((KIDON_SMALL_TRIANGLE2[2] - KIDON_SMALL_TRIANGLE2[4]) * 4, 6), KIDON_SMALL_TRIANGLE2[5] + safeDiv((KIDON_SMALL_TRIANGLE2[3] - KIDON_SMALL_TRIANGLE2[5]) * 4, 6), 
];
const KIDON_CONNECTOR_TRIANGLE2 = [
	-KIDON_CONNECTOR_TRIANGLE1[0], KIDON_CONNECTOR_TRIANGLE1[1],
	-KIDON_CONNECTOR_TRIANGLE1[2], KIDON_CONNECTOR_TRIANGLE1[3],
	-KIDON_CONNECTOR_TRIANGLE1[4], KIDON_CONNECTOR_TRIANGLE1[5],		
];
export const KIDON_TRIANGLES = (() => {
	let pt: Point = {x: 0, y: 0};
	let toRotate = KIDON_BIG_TRIANGLE
 		.concat(KIDON_SMALL_TRIANGLE1)
 		.concat(KIDON_SMALL_TRIANGLE2)
 		.concat(KIDON_CONNECTOR_TRIANGLE1)
 		.concat(KIDON_CONNECTOR_TRIANGLE2);
	for (let i = 0, l = toRotate.length; i < l; i += 2) {
		pt.x = toRotate[i];
		pt.y = toRotate[i+1];
		rotateAndTranslate(pt, -safeDiv(MAX_INT_ANGLE, 4), 0, 0);
		toRotate[i] = pt.x;
		toRotate[i+1] = pt.y;
	}
	return toRotate;
})();// [0,+safeDiv(KIDON_HEIGHT,2),-100,-safeDiv(KIDON_HEIGHT,2),+100,-safeDiv(KIDON_HEIGHT,2)];
export const KIDON_COARSE_RECT = getCoarseSquare(KIDON_TRIANGLES);
export const KIDON_COARSE_RADIUS = getCoarseRadius(KIDON_TRIANGLES);

function makeKidonShotTriangles(width: number, height: number) {
	return [
		+safeDiv(width, 2), 0,
		-safeDiv(width, 2), +safeDiv(height, 2),
		-safeDiv(width, 2), -safeDiv(height, 2)
	];
}

export const KIDON_SHOT_A_WIDTH = safeDiv(KIDON_WIDTH, 2)
export const KIDON_SHOT_A_HEIGHT = safeDiv(KIDON_HEIGHT, 4)
export const KIDON_SHOT_A_TRIANGLES = makeKidonShotTriangles(KIDON_SHOT_A_WIDTH, KIDON_SHOT_A_HEIGHT);
export const KIDON_SHOT_A_COARSE_RADIUS = getCoarseRadius(KIDON_SHOT_A_TRIANGLES);

export const KIDON_SHOT_2A_WIDTH = safeDiv(KIDON_WIDTH, 2)
export const KIDON_SHOT_2A_HEIGHT = safeDiv(KIDON_HEIGHT, 4)
export const KIDON_SHOT_2A_TRIANGLES = makeKidonShotTriangles(KIDON_SHOT_2A_WIDTH, KIDON_SHOT_2A_HEIGHT);
export const KIDON_SHOT_2A_COARSE_RADIUS = getCoarseRadius(KIDON_SHOT_2A_TRIANGLES);

function makeLaserTriangles(width: number, height: number) {
	return [
		0,     +safeDiv(height, 2),
		0,     -safeDiv(height, 2),
		width, +safeDiv(height, 2),
		width, +safeDiv(height, 2),
		width, -safeDiv(height, 2),
		0,     -safeDiv(height, 2)
	];
}

export const KIDON_SHOT_B_WIDTH = KIDON_WIDTH * 8;
export const KIDON_SHOT_B_HEIGHT = safeDiv(KIDON_HEIGHT, 4);
export const KIDON_SHOT_B_TRIANGLES = makeLaserTriangles(KIDON_SHOT_B_WIDTH, KIDON_SHOT_B_HEIGHT);
export const KIDON_SHOT_B_COARSE_RADIUS = getCoarseRadius(KIDON_SHOT_B_TRIANGLES);

export const KIDON_SHOT_8B_WIDTH = safeDiv(KIDON_WIDTH * 3, 2);
export const KIDON_SHOT_8B_HEIGHT = safeDiv(KIDON_HEIGHT, 4);
export const KIDON_SHOT_8B_TRIANGLES = makeLaserTriangles(KIDON_SHOT_8B_WIDTH, KIDON_SHOT_8B_HEIGHT);
export const KIDON_SHOT_8B_COARSE_RADIUS = getCoarseRadius(KIDON_SHOT_8B_TRIANGLES);

