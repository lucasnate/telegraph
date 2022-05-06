// TODO: This file needs to have float protection

import { safeCosMul, safeSinMul, safeDiv, safeAtan2, MAX_INT_ANGLE } from './safeCalc';
import { getCoarseSquare, getCoarseRadius, Point, rotateAndTranslate, ShapeInfo, ShapeInfoType } from './spatial';
import { assert } from '../../src/util/assert';

export const KIDON_WIDTH = 3500;
export const KIDON_HEIGHT = 3500;

function triangles(data: number[]) {
	return {type: ShapeInfoType.Triangles, data: data};
}

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
export const KIDON_TRIANGLES = triangles((() => {
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
})());
export const KIDON_COARSE_RECT = getCoarseSquare(KIDON_TRIANGLES);
export const KIDON_COARSE_RADIUS = getCoarseRadius(KIDON_TRIANGLES);

function makeKidonShotTriangles(width: number, height: number) {
	return triangles([
		+safeDiv(width, 2), 0,
		-safeDiv(width, 2), +safeDiv(height, 2),
		-safeDiv(width, 2), -safeDiv(height, 2)
	]);
}

export const KIDON_SHOT_A1_WIDTH = safeDiv(KIDON_WIDTH, 2)
export const KIDON_SHOT_A1_HEIGHT = safeDiv(KIDON_HEIGHT, 4)
export const KIDON_SHOT_A1_TRIANGLES = makeKidonShotTriangles(KIDON_SHOT_A1_WIDTH, KIDON_SHOT_A1_HEIGHT);
export const KIDON_SHOT_A1_COARSE_RADIUS = getCoarseRadius(KIDON_SHOT_A1_TRIANGLES);

export const KIDON_SHOT_A2_WIDTH = safeDiv(KIDON_WIDTH, 2)
export const KIDON_SHOT_A2_HEIGHT = safeDiv(KIDON_HEIGHT, 4)
export const KIDON_SHOT_A2_TRIANGLES = makeKidonShotTriangles(KIDON_SHOT_A2_WIDTH, KIDON_SHOT_A2_HEIGHT);
export const KIDON_SHOT_A2_COARSE_RADIUS = getCoarseRadius(KIDON_SHOT_A2_TRIANGLES);

function makeLaserTriangles(width: number, height: number) {
	return triangles([
		0,     +safeDiv(height, 2),
		0,     -safeDiv(height, 2),
		width, +safeDiv(height, 2),
		width, +safeDiv(height, 2),
		width, -safeDiv(height, 2),
		0,     -safeDiv(height, 2)
	]);
}

export const KIDON_SHOT_B2_WIDTH = KIDON_WIDTH * 8;
export const KIDON_SHOT_B2_HEIGHT = safeDiv(KIDON_HEIGHT, 4);
export const KIDON_SHOT_B2_TRIANGLES = makeLaserTriangles(KIDON_SHOT_B2_WIDTH, KIDON_SHOT_B2_HEIGHT);
export const KIDON_SHOT_B2_COARSE_RADIUS = getCoarseRadius(KIDON_SHOT_B2_TRIANGLES);

export const KIDON_SHOT_B1_WIDTH = safeDiv(KIDON_WIDTH * 3, 2);
export const KIDON_SHOT_B1_HEIGHT = safeDiv(KIDON_HEIGHT, 4);
export const KIDON_SHOT_B1_TRIANGLES = makeLaserTriangles(KIDON_SHOT_B1_WIDTH, KIDON_SHOT_B1_HEIGHT);
export const KIDON_SHOT_B1_COARSE_RADIUS = getCoarseRadius(KIDON_SHOT_B1_TRIANGLES);

export const KIDON_SHOT_C1_BIG_WIDTH = safeDiv(KIDON_WIDTH * 3, 3)
export const KIDON_SHOT_C1_BIG_HEIGHT = safeDiv(KIDON_HEIGHT * 5, 6)
export const KIDON_SHOT_C1_BIG_TRIANGLES = makeKidonShotTriangles(KIDON_SHOT_C1_BIG_WIDTH, KIDON_SHOT_C1_BIG_HEIGHT);
export const KIDON_SHOT_C1_BIG_COARSE_RADIUS = getCoarseRadius(KIDON_SHOT_C1_BIG_TRIANGLES);

export const KIDON_SHOT_C1_SMALL_WIDTH = safeDiv(KIDON_WIDTH, 2)
export const KIDON_SHOT_C1_SMALL_HEIGHT = safeDiv(KIDON_HEIGHT, 4)
export const KIDON_SHOT_C1_SMALL_TRIANGLES = makeKidonShotTriangles(KIDON_SHOT_C1_SMALL_WIDTH, KIDON_SHOT_C1_SMALL_HEIGHT);
export const KIDON_SHOT_C1_SMALL_COARSE_RADIUS = getCoarseRadius(KIDON_SHOT_C1_SMALL_TRIANGLES);

export const KIDON_SHOT_C2_BIG_WIDTH = safeDiv(KIDON_WIDTH * 3, 3)
export const KIDON_SHOT_C2_BIG_HEIGHT = safeDiv(KIDON_HEIGHT * 5, 6)
export const KIDON_SHOT_C2_BIG_TRIANGLES = makeKidonShotTriangles(KIDON_SHOT_C2_BIG_WIDTH, KIDON_SHOT_C2_BIG_HEIGHT);
export const KIDON_SHOT_C2_BIG_COARSE_RADIUS = getCoarseRadius(KIDON_SHOT_C2_BIG_TRIANGLES);

export const KIDON_SHOT_C2_SMALL_WIDTH = safeDiv(KIDON_WIDTH, 2)
export const KIDON_SHOT_C2_SMALL_HEIGHT = safeDiv(KIDON_HEIGHT, 4)
export const KIDON_SHOT_C2_SMALL_TRIANGLES = makeKidonShotTriangles(KIDON_SHOT_C2_SMALL_WIDTH, KIDON_SHOT_C2_SMALL_HEIGHT);
export const KIDON_SHOT_C2_SMALL_COARSE_RADIUS = getCoarseRadius(KIDON_SHOT_C2_SMALL_TRIANGLES);

export const PARTICLE_TRIANGLES = [
	0, -200,
	0, +200,
	+200, 0,
	0, -200,
	0, +200,
	-200, 0
];

function makeCircleTriangles(radius: number, count: number) {
	return makeSectorTriangles(radius, count, 0, MAX_INT_ANGLE);
}

function makeSectorTriangles(radius: number, count: number, startAngle: number, endAngle: number) {
	const ret = [];
	const angleDiff = endAngle - startAngle;
	for (let i = 0; i < count; ++i) {
		ret.push(0, 0,
				 safeCosMul(radius, startAngle + safeDiv(angleDiff * i, count)),
				 safeSinMul(radius, startAngle + safeDiv(angleDiff * i, count)),
				 safeCosMul(radius, startAngle + safeDiv(angleDiff * (i + 1), count)),
				 safeSinMul(radius, startAngle + safeDiv(angleDiff * (i + 1), count)));
	}
	return triangles(ret);	
}

export const AYIN_WIDTH = 4000;
export const AYIN_HEIGHT = 4000;
assert(AYIN_HEIGHT === AYIN_WIDTH, "Ayin is a circle, so width and height must be the same");
export const AYIN_RENDER_TRIANGLES = makeCircleTriangles(safeDiv(AYIN_WIDTH, 2), 20);
export const AYIN_PUPIL_TRIANGLES = (() => {
	const ret = makeCircleTriangles(safeDiv(AYIN_WIDTH, 2 * 3.54), 10); // it's ok to use 3.54 since this render-only
	for (let i = 0, l = ret.data.length; i < l; i += 2)
		ret.data[i] += safeDiv(AYIN_WIDTH * 3, 2 * 5);
	return ret;
})();
export const AYIN_SHAPE = {type: ShapeInfoType.Circles, data: [0, 0, safeDiv(AYIN_WIDTH, 2)]};
export const AYIN_COARSE_RADIUS = getCoarseRadius(AYIN_SHAPE);
const AYIN_SHOT_A1_WIDTH = AYIN_WIDTH * 2;
const AYIN_SHOT_A1_HEIGHT = AYIN_WIDTH * 6;
const AYIN_SHOT_A1_EDGE_HEIGHT = AYIN_WIDTH * 2;

export const AYIN_SHOT_A1_TRIANGLES = triangles([
	-safeDiv(AYIN_SHOT_A1_WIDTH, 2),
	+safeDiv(AYIN_SHOT_A1_HEIGHT, 2),
	+safeDiv(AYIN_SHOT_A1_WIDTH, 2),
	+safeDiv(AYIN_SHOT_A1_EDGE_HEIGHT, 2),
	+safeDiv(AYIN_SHOT_A1_WIDTH, 2),
	-safeDiv(AYIN_SHOT_A1_EDGE_HEIGHT, 2),

	+safeDiv(AYIN_SHOT_A1_WIDTH, 2),
	+safeDiv(AYIN_SHOT_A1_EDGE_HEIGHT, 2),
	+safeDiv(AYIN_SHOT_A1_WIDTH, 2),
	-safeDiv(AYIN_SHOT_A1_EDGE_HEIGHT, 2),
	-safeDiv(AYIN_SHOT_A1_WIDTH, 2),
    -safeDiv(AYIN_SHOT_A1_HEIGHT, 2),
]);
export const AYIN_SHOT_A1_COARSE_RADIUS	= getCoarseRadius(AYIN_SHOT_A1_TRIANGLES);

export const AYIN_HELPER_B1_WIDTH = safeDiv(AYIN_WIDTH, 2);
export const AYIN_HELPER_B1_SHAPE = {type: ShapeInfoType.Circles, data: [0, 0, safeDiv(AYIN_HELPER_B1_WIDTH, 2)]};
export const AYIN_HELPER_B1_COARSE_RADIUS = getCoarseRadius(AYIN_HELPER_B1_SHAPE);
export const AYIN_HELPER_B1_RENDER_TRIANGLES = makeCircleTriangles(safeDiv(AYIN_HELPER_B1_WIDTH, 2), 20);

// Created from the following Desmos equations:
// x^2+y^2=4 {x > -0.8}
// 0.4364x+2.18 {-5<x<-0.8}
// -0.4364x+-2.18 {-5<x<-0.8}
// 
// Note: the width of these equations is 7
//       the height is 2.

export const AYIN_HELPER_B1_ATTACK_SHOT_SCALE = 150;
//export const AYIN_HELPER_B1_ATTACK_SHOT_WIDTH = 7 * AYIN_HELPER_B1_ATTACK_SHOT_SCALE;
//export const AYIN_HELPER_B1_ATTACK_SHOT_HEIGHT = 200 * AYIN_HELPER_B1_ATTACK_SHOT_SCALE; This one is probably wrong, be careful when uncommenting
export const AYIN_HELPER_B1_ATTACK_SHOT_LEFT_HALF = [-5 * AYIN_HELPER_B1_ATTACK_SHOT_SCALE, 0,
   													 safeDiv(-8 * AYIN_HELPER_B1_ATTACK_SHOT_SCALE, 10), +1 * (safeDiv(safeDiv(-8 * AYIN_HELPER_B1_ATTACK_SHOT_SCALE, 10) * 4364, 10000) + safeDiv(218 * AYIN_HELPER_B1_ATTACK_SHOT_SCALE, 100)),
													 safeDiv(-8 * AYIN_HELPER_B1_ATTACK_SHOT_SCALE, 10), -1 * (safeDiv(safeDiv(-8 * AYIN_HELPER_B1_ATTACK_SHOT_SCALE, 10) * 4364, 10000) + safeDiv(218 * AYIN_HELPER_B1_ATTACK_SHOT_SCALE, 100))];
export const AYIN_HELPER_B1_ATTACK_SHOT_SHAPE = {
	type: ShapeInfoType.Triangles,
	data: AYIN_HELPER_B1_ATTACK_SHOT_LEFT_HALF.concat(makeSectorTriangles(2 * AYIN_HELPER_B1_ATTACK_SHOT_SCALE, 5,
																		  safeAtan2(AYIN_HELPER_B1_ATTACK_SHOT_LEFT_HALF[5], AYIN_HELPER_B1_ATTACK_SHOT_LEFT_HALF[4]),
																		  safeAtan2(AYIN_HELPER_B1_ATTACK_SHOT_LEFT_HALF[3], AYIN_HELPER_B1_ATTACK_SHOT_LEFT_HALF[2]) + MAX_INT_ANGLE).data)
};

export const AYIN_SHOT_A2_TRIANGLES = {
	type: ShapeInfoType.Triangles,
	data: AYIN_HELPER_B1_ATTACK_SHOT_SHAPE.data.map(val => val * 2)
};

export const AYIN_SHOT_C1_TRIANGLES = {
	type: ShapeInfoType.Triangles,
	data: AYIN_SHOT_A1_TRIANGLES.data.map(val => safeDiv(val, 2))
};

		   
		   
