// TODO: This file needs to have float protection

import { assert } from '../../src/util/assert';
import { safeSqrt } from './safeCalc';
import { safeCosMul, safeSinMul, safeDiv } from './safeCalc';

interface CenteredSquare {
	minxy: number;
	maxxy: number;
}

export interface ShapeInfo {
	type: ShapeInfoType,
	data: number[]
}

export enum ShapeInfoType {
	Triangles,
	Circles
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
export function getCoarseSquare(shape: ShapeInfo): CenteredSquare {
	const max_d = getCoarseRadius(shape);
	return {minxy: -max_d, maxxy: +max_d};
}

export function getCoarseRadius(shape: ShapeInfo): number {
	let max_d_sq = 0;
	if (shape.type === ShapeInfoType.Triangles) {
		const triangles = shape.data;
		assert(triangles.length % 2 === 0, "getRotationIndependentBoundingRect - premature EOF");
		for (let i = 0; i < triangles.length; i += 2) {
			const x = triangles[i], y = triangles[i + 1];
			const d_sq = x * x + y * y;
			if (d_sq > max_d_sq)
				max_d_sq = d_sq;
		}
		return safeSqrt(max_d_sq);
	} else if (shape.type === ShapeInfoType.Circles) {
		const circles = shape.data;
		assert(circles.length % 3 === 0, "getRotationIndependentBoundingRect - premature EOF2");
		assert(circles.length === 3 && circles[0] === 0 && circles[1] === 0, "only single circle supported for now");
		return circles[2];
	} else {
		throw new Error("Unsupported shape type");
	}
}

function isLineCircleIntersecting(pt1: Point, pt2: Point, ptCirc: Point, r: number): boolean {
	// I wanted to base this on https://www.phatcode.net/articles.php?id=459
	// but eventually decided on a different approach because the algorithm
	// in that site is less clear and also seems like it can create overly large numbers.
	//
	// Because of this I will use the following algorithm.
	//
	// Let's assume that the circle center is (0,0) (we will fix te points to enforce this).
	// 
	// Let (x,y) be pt1 and (x + dx, y + dx) be pt2.
	// We can define a function: d(t) = (x + t * dx)^2 + (y + t * dy)^2
	//
	// We want to minimze this function because we are only interested in the case where the line crosses
	// the circle, and if that's the case, then the minimum point will be inside the circle.
	//
	// To minimize it we calculate a derivative:
	// d'(t) = 2(x + t * dx) * dx + 2(y + t * dy) * dy
	//
	// Now, let's find t:
	//
	// 0 = 2(x + t * dx) * dx + 2(y + t * dy) * dy
	//
	// 0 = (x + t * dx) * dx + (y + t * dy) * dy
	//
	// 0 = (x * dx + y * dy) + t(dx * dx + dy * dy)
	//
	//        x * dx + y * dy
	// t = -  -----------------
	//        dx * dx + dy * dy
	//
	// Note that to handle issues stemming from division and accuracy, we will actually
	// calculate t multiplied by a constant factor. We will pick a factor that's small
	// enough so that we don't risk a numeric explosion.
	//
	// Now that I think about it, we are going to have one real division here and
	// two divisions by a power of 2 (does JS even optimize those?). I wonder how bad
	// this will be.
	//
	// But anyways, now that we have t, we can calculate d(t).
	
	const x = pt1.x - ptCirc.x;
	const y = pt1.y - ptCirc.y;
	const dx = pt2.x - pt1.x;
	const dy = pt2.y - pt1.y;
	const dx2dy2 = dx * dx + dy * dy;
	const t_numerator = -(x * dx + y * dy);
	if (t_numerator < 0 || t_numerator > dx2dy2) // point is not in segment 
		return false;
	const T_FACTOR = 1024;
	const t_multiplied = safeDiv(t_numerator * T_FACTOR, dx2dy2);
	const best_x = (x + safeDiv(t_multiplied * dx, T_FACTOR));
	const best_y = (y + safeDiv(t_multiplied * dy, T_FACTOR));
	const dist_sq = best_x * best_x + best_y * best_y;
	return dist_sq < r * r;
}

function isLineIntersecting(pt1: Point, pt2: Point, pt3: Point, pt4: Point) {
	// This code is going to be based on https://en.wikipedia.org/wiki/Line%E2%80%93line_intersection#Given_two_points_on_each_line_segment
	// Below is an example that shows how to calculate u.
	//
	// We think of the first line as:
	//
	// pt1 + t(pt2 - pt1)
	//
	//
	// Thus, we are trying to solve:
	// pt1 + t(pt2 - pt1) = pt3 + u(pt4 - pt3)
	//
	//
	// We have two equations now:
	//
	// x1 + t(x2 - x1) = x3 + u(x4 - x3)
	// y1 + t(y2 - y1) = y3 + u(y4 - y3)
	//
	// According to the first line, we get:
	//
	//     (x3 - x1) + u(x4 - x3)     
	// t = ----------------------
	//           (x2 - x1)
	//
	// Let's put in the second one:
	//
	//
	//      (x3 - x1) + u(x4 - x3) 
	// y1 + ----------------------(y2 - y1) = y3 + u(y4 - y3)
	//           (x2 - x1)
	//
	//
	// y1(x2 - x1) + (x3 - x1)(y2 - y1) + u(x4 - x3)(y2 - y1) = y3(x2 - x1) + u(y4 - y3)(x2 - x1)
	//
	// (y1 - y3)(x2 - x1) + (x3 - x1)(y2 - y1) + u(x4 - x3)(y2 - y1) = u(y4 - y3)(x2 - x1)
	//
	// (y1 - y3)(x2 - x1) + (x3 - x1)(y2 - y1) = u((y4 - y3)(x2 - x1) - (x4 - x3)(y2 - y1))
	//
	//
	//     (y1 - y3)(x2 - x1) + (x3 - x1)(y2 - y1)
	// u = ---------------------------------------
    //     (y4 - y3)(x2 - x1) - (x4 - x3)(y2 - y1)
	//
	//     (y1 - y3)(x2 - x1) + (x1 - x3)(y1 - y2)
	// u = ---------------------------------------
    //     (y4 - y3)(x2 - x1) - (x4 - x3)(y2 - y1)
	//
	//     (x1 - x3)(y1 - y2) - (y1 - y3)(x1 - x2) 
	// u = ---------------------------------------
    //     (y4 - y3)(x2 - x1) - (x4 - x3)(y2 - y1)
	//
	//     (x1 - x3)(y1 - y2) - (y1 - y3)(x1 - x2) 
	// u = ---------------------------------------
    //     (y3 - y4)(x1 - x2) - (x4 - x3)(y2 - y1)
	//
	//     (x1 - x3)(y1 - y2) - (y1 - y3)(x1 - x2) 
	// u = ---------------------------------------
    //     (y3 - y4)(x1 - x2) - (x4 - x3)(y2 - y1)


	let x1 = pt1.x, y1 = pt1.y, x2 = pt2.x, y2 = pt2.y, x3 = pt3.x, y3 = pt3.y, x4 = pt4.x, yt4 = pt4.y;
	let x12 = pt1.x - pt2.x;
	let x13 = pt1.x - pt3.x;
	let x34 = pt3.x - pt4.x;
	let y12 = pt1.y - pt2.y;
	let y13 = pt1.y - pt3.y;
	let y34 = pt3.y - pt4.y;
	let t_nom = x13 * y34 - y13 * x34;
	let t_denom = x12 * y34 - y12 * x34;
	let u_nom = x13 * y12 - y13 * x12;
	let u_denom = x12 * y34 - y12 * x34;
	let is_t_good = t_denom > 0 ? (0 <= t_nom && t_nom <= t_denom) : (t_denom <= t_nom && t_nom <= 0);
	let is_u_good = u_denom > 0 ? (0 <= u_nom && u_nom <= u_denom) : (u_denom <= u_nom && u_nom <= 0);
	return is_t_good && is_u_good;
}
	
function squarePointDistance(pt1: Point, pt2: Point): number {
	const dx = pt2.x - pt1.x;
	const dy = pt2.y - pt1.y;
	return dx * dx + dy * dy;
}
	
function isPointInTriangle(pt: Point, pt1: Point, pt2: Point, pt3: Point) {
	// We construct barycentric coordinates with pt1 as (0,0)
	//
	// We want to invert the following matrix:
	//
	//  bx cx
	//  by cy
	//
	// After inversion it becomes:
	//                   +cy -cx   
	// (bxcy-bycx)^-1 *
	//                   -by +bx
	//
	// We want to avoid division so we will accept the upped scale.

	let px = pt.x - pt1.x;
	let py = pt.y - pt1.y;
	let bx = pt2.x - pt1.x;
	let by = pt2.y - pt1.y;
	let cx = pt3.x - pt1.x;
	let cy = pt3.y - pt1.y;
	let d = bx*cy - by*cx;
	let baricentric_x = px * cy - py * cx;
	let baricentric_y = py * bx - px * by;
	if (d > 0) {
		return baricentric_x >= 0 && baricentric_y >= 0 && baricentric_x + baricentric_y <= d;
	} else {	
		return baricentric_x <= 0 && baricentric_y <= 0 && baricentric_x + baricentric_y >= d;	
	}
}

const fttcPoint1: Point = {x: 0, y: 0};
const fttcPoint2: Point = {x: 0, y: 0};
const fttcPoint3: Point = {x: 0, y: 0};
const fttcPoint4: Point = {x: 0, y: 0};
const fttcPoint5: Point = {x: 0, y: 0};
const fttcPoint6: Point = {x: 0, y: 0};
function fineTransformedTriangleCollision(triangles1: number[], i1: number, e1x: number, e1y: number, e1a: number,
										  triangles2: number[], i2: number, e2x: number, e2y: number, e2a: number) {
	fttcPoint1.x = triangles1[i1+0];
	fttcPoint1.y = triangles1[i1+1];
	fttcPoint2.x = triangles1[i1+2];
	fttcPoint2.y = triangles1[i1+3];
	fttcPoint3.x = triangles1[i1+4];
	fttcPoint3.y = triangles1[i1+5];
	fttcPoint4.x = triangles2[i2+0];
	fttcPoint4.y = triangles2[i2+1];
	fttcPoint5.x = triangles2[i2+2];
	fttcPoint5.y = triangles2[i2+3];
	fttcPoint6.x = triangles2[i2+4];
	fttcPoint6.y = triangles2[i2+5];
	rotateAndTranslate(fttcPoint1, e1a, e1x, e1y);
	rotateAndTranslate(fttcPoint2, e1a, e1x, e1y);
	rotateAndTranslate(fttcPoint3, e1a, e1x, e1y);
	rotateAndTranslate(fttcPoint4, e2a, e2x, e2y);
	rotateAndTranslate(fttcPoint5, e2a, e2x, e2y);
	rotateAndTranslate(fttcPoint6, e2a, e2x, e2y);

	// See https://stackoverflow.com/questions/2778240/detection-of-triangle-collision-in-2d-space
	return isLineIntersecting(fttcPoint1, fttcPoint2, fttcPoint4, fttcPoint5) ||
		isLineIntersecting(fttcPoint1, fttcPoint2, fttcPoint5, fttcPoint6) ||
		isLineIntersecting(fttcPoint1, fttcPoint2, fttcPoint6, fttcPoint4) ||
		isLineIntersecting(fttcPoint2, fttcPoint3, fttcPoint4, fttcPoint5) ||
		isLineIntersecting(fttcPoint2, fttcPoint3, fttcPoint5, fttcPoint6) ||
		isLineIntersecting(fttcPoint2, fttcPoint3, fttcPoint6, fttcPoint4) ||
		isLineIntersecting(fttcPoint3, fttcPoint1, fttcPoint4, fttcPoint5) ||
		isLineIntersecting(fttcPoint3, fttcPoint1, fttcPoint5, fttcPoint6) ||
		isPointInTriangle(fttcPoint1, fttcPoint4, fttcPoint5, fttcPoint6) ||
		isPointInTriangle(fttcPoint4, fttcPoint1, fttcPoint2, fttcPoint3);
}

function fineTransformedCircleCollision(circles1: number[], i1: number, e1x: number, e1y: number,
										circles2: number[], i2: number, e2x: number, e2y: number) {
	const x1 = circles1[i1 + 0] + e1x;
	const y1 = circles1[i1 + 1] + e1y;
	const r1 = circles1[i1 + 2];
	const x2 = circles2[i2 + 0] + e2x;
	const y2 = circles2[i2 + 1] + e2y;
	const r2 = circles1[i2 + 2];
	const dist = (r1 + r2);
	const dx = x2 - x1;
	const dy = y2 - y1;
	return dx * dx + dy * dy < dist * dist;
}

const ftTriCircPt1: Point = {x: 0, y: 0};
const ftTriCircPt2: Point = {x: 0, y: 0};
const ftTriCircPt3: Point = {x: 0, y: 0};
const ftTriCircPt4: Point = {x: 0, y: 0};
function fineTransformedTriangleCircleCollision(triangles1: number[], i1: number, e1x: number, e1y: number, e1a: number,
												circles2: number[], i2: number, e2x: number, e2y: number) {
	ftTriCircPt1.x = triangles1[i1+0];
	ftTriCircPt1.y = triangles1[i1+1];
	ftTriCircPt2.x = triangles1[i1+2];
	ftTriCircPt2.y = triangles1[i1+3];
	ftTriCircPt3.x = triangles1[i1+4];
	ftTriCircPt3.y = triangles1[i1+5];
	ftTriCircPt4.x = circles2[i2+0] + e2x;
	ftTriCircPt4.y = circles2[i2+1] + e2y;
	const r = circles2[i2+2];
	const rsq = r * r;
	rotateAndTranslate(ftTriCircPt1, e1a, e1x, e1y);
	rotateAndTranslate(ftTriCircPt2, e1a, e1x, e1y);
	rotateAndTranslate(ftTriCircPt3, e1a, e1x, e1y);

	// See https://www.phatcode.net/articles.php?id=459, note that isLineCircleIntersecting is
	// implemented different from they say.
	return isPointInTriangle(ftTriCircPt4, ftTriCircPt1, ftTriCircPt2, ftTriCircPt3) ||
		squarePointDistance(ftTriCircPt1, ftTriCircPt4) < rsq ||
		squarePointDistance(ftTriCircPt2, ftTriCircPt4) < rsq ||
		squarePointDistance(ftTriCircPt3, ftTriCircPt4) < rsq ||
		isLineCircleIntersecting(ftTriCircPt1, ftTriCircPt2, ftTriCircPt4, r) ||
		isLineCircleIntersecting(ftTriCircPt2, ftTriCircPt3, ftTriCircPt4, r) ||
		isLineCircleIntersecting(ftTriCircPt3, ftTriCircPt1, ftTriCircPt4, r);		
}

export function fineShapeCollision(x1: number, y1: number, a1: number, shape1: ShapeInfo,
								   x2: number, y2: number, a2: number, shape2: ShapeInfo) {
	if (shape1.type === ShapeInfoType.Triangles && shape2.type === ShapeInfoType.Triangles) {
		const triangles1 = shape1.data, triangles2 = shape2.data;
		for (let i1 = 0, l1 = triangles1.length; i1 < l1; i1 += 6) {
			for (let i2 = 0, l2 = triangles2.length; i2 < l2; i2 += 6) {
				if (fineTransformedTriangleCollision(triangles1, i1, x1, y1, a1,
													 triangles2, i2, x2, y2, a2))
					return true;
			}
		}
	} else if (shape1.type === ShapeInfoType.Triangles && shape2.type === ShapeInfoType.Circles) {
		const triangles1 = shape1.data, circles2 = shape2.data;
		for (let i1 = 0, l1 = triangles1.length; i1 < l1; i1 += 6) {
			for (let i2 = 0, l2 = circles2.length; i2 < l2; i2 += 3) {
				if (fineTransformedTriangleCircleCollision(triangles1, i1, x1, y1, a1,
														   circles2, i2, x2, y2))
					return true;
			}
		}
	} else if (shape1.type === ShapeInfoType.Circles && shape2.type === ShapeInfoType.Triangles) {
		const circles1 = shape1.data, triangles2 = shape2.data;
		for (let i1 = 0, l1 = circles1.length; i1 < l1; i1 += 3) {
			for (let i2 = 0, l2 = triangles2.length; i2 < l2; i2 += 3) {
				if (fineTransformedTriangleCircleCollision(triangles2, i2, x2, y2, a2,
														   circles1, i1, x1, y1))
					return true;
			}
		}
	} else if (shape1.type === ShapeInfoType.Circles && shape2.type === ShapeInfoType.Circles) {
		const circles1 = shape1.data, circles2 = shape2.data;
		for (let i1 = 0, l1 = circles1.length; i1 < l1; i1 += 3) {
			for (let i2 = 0, l2 = circles2.length; i2 < l2; i2 += 3) {
				if (fineTransformedCircleCollision(circles1, i1, x1, y1,
												   circles2, i2, x2, y2))
					return true;
			}
		}
	} else {
		throw new Error("Unspported shape type pair in fine collision");
	}
	return false;
}
