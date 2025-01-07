import type { Point, Poly, PolyBox, Rect } from "./types";

// Fast atan2
export const fastAtan2 = (y: number, x: number): number => {
	const QPI = Math.PI / 4;
	const TQPI = (3 * Math.PI) / 4;
	let r = 0.0;
	let angle = 0.0;
	const abs_y = Math.abs(y) + 1e-10;
	if (x < 0) {
		r = (x + abs_y) / (abs_y - x);
		angle = TQPI;
	} else {
		r = (x - abs_y) / (x + abs_y);
		angle = QPI;
	}
	angle += (0.1963 * r * r - 0.9817) * r;
	if (y < 0) {
		return -angle;
	}

	return angle;
};

// Given the start and end of a line, is point left.
export const isLeft = (start: Point, end: Point, point: Point): boolean => {
	return (
		(end.x - start.x) * (point.y - start.y) -
			(end.y - start.y) * (point.x - start.x) >
		0
	);
};

// Get distance squared
export const getDistance2 = (
	x1: number,
	y1: number,
	x2: number,
	y2: number,
): number => {
	return (x1 - x2) ** 2 + (y1 - y2) ** 2;
};

// return unit vector in the direction of the argument
export const unitVector = (v: Point): Point => {
	const l = Math.sqrt(v.x * v.x + v.y * v.y);
	return l > 0 ? { x: v.x / l, y: v.y / l } : { x: 0, y: 0 };
};

// Check if point in Rect
export const pointInRect = (point: Point, rect: Rect): boolean => {
	return (
		rect.x <= point.x &&
		rect.y <= point.y &&
		rect.x + rect.w >= point.x &&
		rect.y + rect.h >= point.y
	);
};

// check if point is in polygon
export const pointInPoly = (point: Point, poly: PolyBox): boolean => {
	if (
		point.x < poly.minx ||
		point.x > poly.maxx ||
		point.y < poly.miny ||
		point.y > poly.maxy
	) {
		return false;
	}

	let c = false;
	const pts = poly.pts;
	const l = pts.length;
	for (let i = 0, j = l - 1; i < l; j = i++) {
		if (
			pts[i].y > point.y !== pts[j].y > point.y &&
			point.x <
				((pts[j].x - pts[i].x) * (point.y - pts[i].y)) / (pts[j].y - pts[i].y) +
					pts[i].x
		) {
			c = !c;
		}
	}
	return c;
};

export const addPolyBox = (poly: Poly): PolyBox => {
	const pts = poly.pts;
	let minx = pts[0].x;
	let maxx = pts[0].x;
	let miny = pts[0].y;
	let maxy = pts[0].y;
	for (let p = 1, l = pts.length; p < l; p++) {
		if (pts[p].x < minx) {
			minx = pts[p].x;
		}
		if (pts[p].x > maxx) {
			maxx = pts[p].x;
		}
		if (pts[p].y < miny) {
			miny = pts[p].y;
		}
		if (pts[p].y > maxy) {
			maxy = pts[p].y;
		}
	}
	return {
		pts: pts,
		minx: minx,
		maxx: maxx,
		miny: miny,
		maxy: maxy,
	};
};

export const cross = (o: Point, a: Point, b: Point): number => {
	return (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
};

const convexHullSort = <P extends Point>(a: P, b: P): number => {
	return a.x === b.x ? a.y - b.y : a.x - b.x;
};

export const convexHull = (points: Point[]): Point[] => {
	points.sort(convexHullSort);

	const lower: Point[] = [];
	for (let i = 0, l = points.length; i < l; i++) {
		while (
			lower.length >= 2 &&
			cross(lower[lower.length - 2], lower[lower.length - 1], points[i]) <= 0
		) {
			lower.pop();
		}
		lower.push(points[i]);
	}

	const upper: Point[] = [];
	for (let i = points.length - 1; i >= 0; i--) {
		while (
			upper.length >= 2 &&
			cross(upper[upper.length - 2], upper[upper.length - 1], points[i]) <= 0
		) {
			upper.pop();
		}
		upper.push(points[i]);
	}

	upper.pop();
	lower.pop();
	return lower.concat(upper);
};
