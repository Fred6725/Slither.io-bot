import type { ISlither, ISlitherPoint } from "../slither/interface";
import {
	addPolyBox,
	convexHull,
	fastAtan2,
	getDistance2,
	isLeft,
	pointInPoly,
	unitVector,
} from "./canvas";
import type {
	BodyPoint,
	Circle,
	CollisionAngle,
	CollisionPoint,
	CollisionPointHead,
	CollisionPointPart,
	CollisionPointWall,
	FoodAngle,
	FoodPoint,
	IntersectPoint,
	OpenAngle,
	Point,
	PolyBox,
} from "./types";
import { Visualizer } from "./visualizer";
import { GodModeAssist } from "./god-mode";

const visualizer = new Visualizer();
const godModeAssist = new GodModeAssist();

export class Bot {
	stage = "grow";
	collisionPoints: CollisionPoint[] = [];
	collisionAngles: (CollisionAngle | undefined)[] = [];
	foodAngles: (FoodAngle | undefined)[] = [];
	defaultAccel: 0 | 1 = 0;
	currentFood: FoodAngle | undefined;
	opt = {
		// target fps
		targetFps: 60,
		// size of arc for collisionAngles
		arcSize: Math.PI / 8,
		// radius multiple for circle intersects
		radiusMult: 10,
		// food cluster size to trigger acceleration
		foodAccelSz: 200,
		// maximum angle of food to trigger acceleration
		foodAccelDa: Math.PI / 2,
		// how many frames per action
		actionFrames: 2,
		// how many frames to delay action after collision
		collisionDelay: 10,
		// base speed
		speedBase: 5.78,
		// front angle size
		frontAngle: Math.PI / 2,
		// percent of angles covered by same snake to be considered an encircle attempt
		enCircleThreshold: 0.5625,
		// percent of angles covered by all snakes to move to safety
		enCircleAllThreshold: 0.5625,
		// distance multiplier for enCircleAllThreshold
		enCircleDistanceMult: 20,
		// snake score to start circling on self
		followCircleLength: 2000,
		// direction for followCircle: +1 for counter clockwise and -1 for clockwise
		followCircleDirection: +1,
	};

	MAXARC = 0;

	#enableEncircle = true;
	#enbaleFollowCircle = true;
	#borderPointRadius = 20;

	#goalCoordinates: Point = { x: 0, y: 0 };
	#headCircle: Circle = { x: 0, y: 0, r: 0 };
	#sideCircleL: Circle = { x: 0, y: 0, r: 0 };
	#sideCircleR: Circle = { x: 0, y: 0, r: 0 };

	#id = 0;
	#pts: ISlitherPoint[] = [];
	#x = 0;
	#y = 0;
	#ang = 0;
	#cos = 0;
	#sin = 0;
	#speedMult = 1;
	#width = 0;
	#radius = 0;
	#snakeLength = 0;

	#bodyPoints: BodyPoint[] = [];
	#len = 0;

	#delayFrame = 0;

	public onSetCoordinates = (x: number, y: number) => {};
	public onAcceleration = (accel: 0 | 1) => {};

	public visualizeEnabled(enabled: boolean): void {
		visualizer.enabled = enabled;
	}

	public godModeEnabled(enabled: boolean): void {
		godModeAssist.setEnabled(enabled);
		console.log(`🔥 GOD MODE ASSIST: ${enabled ? 'ENABLED' : 'DISABLED'}`);
	}

	public godModeVisualsEnabled(enabled: boolean): void {
		godModeAssist.setVisualsEnabled(enabled);
		console.log(`👁️ GOD MODE VISUALS: ${enabled ? 'ENABLED' : 'DISABLED'}`);
	}

	public isGodModeEnabled(): boolean {
		return godModeAssist.isEnabled();
	}

	public isGodModeVisualsEnabled(): boolean {
		return godModeAssist.isVisualsEnabled();
	}

	/**
	 * Checks if god mode assist should take control (independent of bot)
	 */
	public checkGodModeAssist(): boolean {
		if (!window.ourSnake || !window.playing) return false;
		return godModeAssist.checkAndAssist(window.ourSnake);
	}

	/**
	 * Draws god mode visuals independently
	 */
	public drawGodModeVisuals(): void {
		godModeAssist.drawVisuals();
	}

	public getSnakeLength(sk: ISlither): number {
		if (null == sk || 0 > sk.sct || 0 > sk.fam || 0 > sk.rsc) {
			return 0;
		}

		const sct = sk.sct + sk.rsc;
		return Math.trunc(
			15 * (window.fpsls[sct] + sk.fam / window.fmlts[sct] - 1) - 5,
		);
	}

	getSnakeWidth(sc: number): number {
		return Math.round(sc * 29);
	}

	// Check if circles intersect
	circleIntersect(
		circle1: Circle,
		circle2: Circle,
	): IntersectPoint | undefined {
		const bothRadii = circle1.r + circle2.r;

		// Pretends the circles are squares for a quick collision check.
		// If it collides, do the more expensive circle check.
		if (
			circle1.x + bothRadii > circle2.x &&
			circle1.y + bothRadii > circle2.y &&
			circle1.x < circle2.x + bothRadii &&
			circle1.y < circle2.y + bothRadii
		) {
			const distance2 = getDistance2(
				circle1.x,
				circle1.y,
				circle2.x,
				circle2.y,
			);

			if (distance2 < bothRadii * bothRadii) {
				const x = (circle1.x * circle2.r + circle2.x * circle1.r) / bothRadii;
				const y = (circle1.y * circle2.r + circle2.y * circle1.r) / bothRadii;
				const a = fastAtan2(y - this.#y, x - this.#x);

				const point: IntersectPoint = { x, y, a };

				return point;
			}
		}

		return undefined;
	}

	// angleBetween - get the smallest angle between two angles (0-pi)
	angleBetween(a1: number, a2: number): number {
		const r1 = (a1 - a2) % Math.PI;
		const r2 = (a2 - a1) % Math.PI;

		return r1 < r2 ? -r1 : r2;
	}

	// Change heading to ang
	changeHeadingAbs(angle: number): Point {
		const cos = Math.cos(angle);
		const sin = Math.sin(angle);

		return {
			x: Math.round(this.#x + 500 * cos),
			y: Math.round(this.#y + 500 * sin),
		};
	}

	// Change heading by ang
	// +0-pi turn left
	// -0-pi turn right
	changeHeadingRel(angle: number): Point {
		const heading = {
			x: this.#x + 500 * this.#cos,
			y: this.#y + 500 * this.#sin,
		};

		const cos = Math.cos(-angle);
		const sin = Math.sin(-angle);

		return {
			x: Math.round(
				cos * (heading.x - this.#x) - sin * (heading.y - this.#y) + this.#x,
			),
			y: Math.round(
				sin * (heading.x - this.#x) + cos * (heading.y - this.#y) + this.#y,
			),
		};
	}

	// Change heading to the best angle for avoidance.
	headingBestAngle(): void {
		const openAngles: OpenAngle[] = [];
		let best: { distance: number; aIndex: number } | undefined;
		let distance: number;
		let openStart: number | undefined;

		let sIndex = this.getAngleIndex(this.#ang) + this.MAXARC / 2;
		if (sIndex > this.MAXARC) sIndex -= this.MAXARC;

		for (let i = 0; i < this.MAXARC; i++) {
			const ao = this.collisionAngles[i];
			if (ao === undefined) {
				distance = 0;
				if (openStart === undefined) {
					openStart = i;
				}
			} else {
				distance = ao.d2;
				if (openStart) {
					openAngles.push({
						openStart: openStart,
						openEnd: i - 1,
						sz: i - 1 - openStart,
					});
					openStart = undefined;
				}
			}

			if (
				best === undefined ||
				(best.distance < distance && best.distance !== 0)
			) {
				best = {
					distance: distance,
					aIndex: i,
				};
			}
		}

		if (openStart && openAngles[0]) {
			openAngles[0].openStart = openStart;
			openAngles[0].sz = openAngles[0].openEnd - openStart;
			if (openAngles[0].sz < 0) openAngles[0].sz += this.MAXARC;
		} else if (openStart) {
			openAngles.push({ openStart: openStart, openEnd: openStart, sz: 0 });
		}

		if (openAngles.length > 0) {
			openAngles.sort(this.sortSz);
			this.#goalCoordinates = this.changeHeadingAbs(
				(openAngles[0].openEnd - openAngles[0].sz / 2) * this.opt.arcSize,
			);
		} else if (best) {
			this.#goalCoordinates = this.changeHeadingAbs(
				best.aIndex * this.opt.arcSize,
			);
		}
	}

	// Avoid collision point by ang
	// ang radians <= Math.PI (180deg)
	avoidCollisionPoint(point: IntersectPoint, angle?: number): void {
		const ang = angle === undefined || angle > Math.PI ? Math.PI : angle;
		const head: Point = {
			x: this.#x,
			y: this.#y,
		};
		const end: Point = {
			x: this.#x + 2000 * this.#cos,
			y: this.#y + 2000 * this.#sin,
		};

		const left = isLeft(head, end, point);

		visualizer.drawLine(head, end, "orange");
		visualizer.drawLine(head, point, "red");

		this.#goalCoordinates = this.changeHeadingAbs(
			left ? point.a - ang : point.a + ang,
		);
	}

	// get collision angle index, expects angle +/i 0 to Math.PI
	getAngleIndex(angle: number): number {
		let ang = angle;
		if (angle < 0) {
			ang += 2 * Math.PI;
		}

		const index = Math.round(ang * (1 / this.opt.arcSize));

		return index === this.MAXARC ? 0 : index;
	}

	// Add to collisionAngles if distance is closer
	addCollisionAngle(sp: CollisionPoint): void {
		const ang = fastAtan2(
			Math.round(sp.y - this.#y),
			Math.round(sp.x - this.#x),
		);
		const aIndex = this.getAngleIndex(ang);
		const actualDistance = Math.round((Math.sqrt(sp.d2) - sp.r) ** 2);

		if (
			this.collisionAngles[aIndex] === undefined ||
			this.collisionAngles[aIndex].d2 > sp.d2
		) {
			this.collisionAngles[aIndex] = {
				x: Math.round(sp.x),
				y: Math.round(sp.y),
				ang: ang,
				si: sp.si,
				d2: actualDistance,
				r: sp.r,
				aIndex: aIndex,
			};
		}
	}

	// Add and score foodAngles
	addFoodAngle(f: FoodPoint): void {
		const ang = fastAtan2(Math.round(f.y - this.#y), Math.round(f.x - this.#x));
		const aIndex = this.getAngleIndex(ang);

		if (
			this.collisionAngles[aIndex] === undefined ||
			Math.sqrt(this.collisionAngles[aIndex].d2) >
				Math.sqrt(f.d2) +
					(this.#radius * this.opt.radiusMult * this.#speedMult) / 2
		) {
			const fa = this.foodAngles[aIndex];
			if (fa === undefined) {
				this.foodAngles[aIndex] = {
					x: Math.round(f.x),
					y: Math.round(f.y),
					ang: ang,
					da: Math.abs(this.angleBetween(ang, this.#ang)),
					d2: f.d2,
					sz: f.sz,
					score: f.sz ** 2 / f.d2,
				};
			} else {
				fa.sz += Math.round(f.sz);
				fa.score += f.sz ** 2 / f.d2;
				if (fa.d2 > f.d2) {
					fa.x = Math.round(f.x);
					fa.y = Math.round(f.y);
					fa.d2 = f.d2;
				}
			}
		}
	}

	// Get closest collision point per snake.
	getCollisionPoints(): void {
		this.collisionPoints = [];
		this.collisionAngles = [];

		const farCollisionD2 = (this.#width * 50) ** 2;

		for (let i = 0, ls = window.slithers.length; i < ls; i++) {
			if (window.slithers[i].id === this.#id) continue;

			const s = window.slithers[i];

			const sRadius = this.getSnakeWidth(s.sc) / 2;
			const sSpMult = Math.min(1, s.sp / 5.78 - 1);
			const sRadiusMult = sRadius * sSpMult * this.opt.radiusMult;

			const x = s.xx + (Math.cos(s.ang) * sRadiusMult) / 2;
			const y = s.yy + (Math.sin(s.ang) * sRadiusMult) / 2;
			const d2 = getDistance2(this.#x, this.#y, x, y);

			const scPoint: CollisionPointHead = {
				x: x,
				y: y,
				r: this.#headCircle.r,
				d2: d2,
				si: i,
				type: 0,
				speed: s.sp,
			};

			this.addCollisionAngle(scPoint);
			this.collisionPoints.push(scPoint);

			visualizer.drawCircle(scPoint, "red");

			const pts = s.pts;
			for (let j = 0, lp = pts.length; j < lp; j++) {
				const po = pts[j];

				if (po == null || po.dying) continue;

				const pd2 = getDistance2(this.#x, this.#y, po.xx, po.yy);

				if (pd2 > farCollisionD2) continue;

				const collisionPoint: CollisionPointPart = {
					x: po.xx,
					y: po.yy,
					r: sRadius,
					d2: pd2,
					si: i,
					type: 1,
				};

				this.addCollisionAngle(collisionPoint);

				if (collisionPoint.d2 <= (this.#headCircle.r + collisionPoint.r) ** 2) {
					this.collisionPoints.push(collisionPoint);
				}
			}
		}

		// WALL
		const intoViewWall = Math.abs(window.flux_grd - window.view_dist) < 1e3;
		if (intoViewWall) {
			const borderDist = window.flux_grd + this.#borderPointRadius;
			const borderPointWidth = this.#borderPointRadius * 2;

			for (let j = 3, i = -j; i <= j; i++) {
				const wa = window.view_ang + (i * borderPointWidth) / window.flux_grd;
				const wx = window.grd + borderDist * Math.cos(wa);
				const wy = window.grd + borderDist * Math.sin(wa);

				const wd2 = getDistance2(this.#x, this.#y, wx, wy);
				const wallPoint: CollisionPointWall = {
					x: wx,
					y: wy,
					r: this.#borderPointRadius,
					d2: wd2,
					si: -1,
					type: 2,
				};
				this.collisionPoints.push(wallPoint);
				this.addCollisionAngle(wallPoint);

				visualizer.drawCircle(wallPoint, "yellow");
			}
		}

		this.collisionPoints.sort(this.sortDistance);
	}

	// Is collisionPoint (xx) in frontAngle
	inFrontAngle(point: Point): boolean {
		const ang = fastAtan2(
			Math.round(point.y - this.#y),
			Math.round(point.x - this.#x),
		);

		return Math.abs(this.angleBetween(ang, this.#ang)) < this.opt.frontAngle;
	}

	// Checks to see if you are going to collide with anything in the collision detection radius
	checkCollision(): boolean {
		this.getCollisionPoints();
		if (this.collisionPoints.length === 0) return false;

		for (let i = 0; i < this.collisionPoints.length; i++) {
			const cp = this.collisionPoints[i];
			const collisionCircle = {
				x: cp.x,
				y: cp.y,
				r: cp.r,
			};

			const intersectPoint = this.circleIntersect(
				this.#headCircle,
				collisionCircle,
			);
			if (intersectPoint && this.inFrontAngle(intersectPoint)) {
				if (cp.type === 0 && window.slithers[cp.si].sp > 10) {
					this.onAcceleration(1);
				} else {
					this.onAcceleration(this.defaultAccel);
				}
				this.avoidCollisionPoint(intersectPoint);
				return true;
			}
		}

		this.onAcceleration(this.defaultAccel);
		return false;
	}

	checkEncircle(): boolean {
		if (!this.#enableEncircle) return false;

		const enSnake: number[] = [];
		let high = 0;
		let highSnake = 0;
		let enAll = 0;

		for (let i = 0; i < this.collisionAngles.length; i++) {
			const ca = this.collisionAngles[i];
			if (ca !== undefined) {
				const si = ca.si;
				if (enSnake[si]) {
					enSnake[si]++;
				} else {
					enSnake[si] = 1;
				}
				if (enSnake[si] > high) {
					high = enSnake[si];
					highSnake = si;
				}

				if (ca.d2 < (this.#radius * this.opt.enCircleDistanceMult) ** 2) {
					enAll++;
				}
			}
		}

		if (high > this.MAXARC * this.opt.enCircleThreshold) {
			this.headingBestAngle();

			if (high !== this.MAXARC && window.slithers[highSnake].sp > 10) {
				this.onAcceleration(1);
			} else {
				this.onAcceleration(this.defaultAccel);
			}

			visualizer.drawCircle(
				{
					x: this.#x,
					y: this.#y,
					r: this.opt.radiusMult * this.#radius,
				},
				"red",
				true,
				0.2,
			);

			return true;
		}

		if (enAll > this.MAXARC * this.opt.enCircleAllThreshold) {
			this.headingBestAngle();
			this.onAcceleration(this.defaultAccel);

			visualizer.drawCircle(
				{
					x: this.#x,
					y: this.#y,
					r: this.opt.radiusMult * this.opt.enCircleDistanceMult,
				},
				"yellow",
				true,
				0.2,
			);

			return true;
		}

		this.onAcceleration(this.defaultAccel);

		visualizer.drawCircle(
			{
				x: this.#x,
				y: this.#y,
				r: this.opt.radiusMult * this.opt.enCircleDistanceMult,
			},
			"yellow",
		);

		return false;
	}

	populatePts() {
		let x = this.#x;
		let y = this.#y;
		let l = 0.0;
		this.#bodyPoints = [{ x: x, y: y, len: l }];
		const pts = this.#pts;
		for (let p = pts.length - 1; p >= 0; p--) {
			const po = pts[p];
			if (po.dying) {
				continue;
			}
			const xx = po.xx;
			const yy = po.yy;
			const ll = l + Math.sqrt(getDistance2(x, y, xx, yy));
			this.#bodyPoints.push({ x: xx, y: yy, len: ll });
			x = xx;
			y = yy;
			l = ll;
		}
		this.#len = l;
	}

	// set the direction of rotation based on the velocity of
	// the head with respect to the center of mass
	determineCircleDirection(): void {
		// find center mass (cx, cy)
		let cx = 0.0;
		let cy = 0.0;
		const bodyPoints = this.#bodyPoints;
		const pn = bodyPoints.length;
		for (let p = 0; p < pn; p++) {
			cx += bodyPoints[p].x;
			cy += bodyPoints[p].y;
		}
		cx /= pn;
		cy /= pn;

		// vector from (cx, cy) to the head
		const dx = this.#x - cx;
		const dy = this.#y - cy;

		// check the sign of dot product of (this.#cos, this.#sin) and (-dy, dx)
		if (-dy * this.#cos + dx * this.#sin > 0) {
			// clockwise
			this.opt.followCircleDirection = -1;
		} else {
			// couter clockwise
			this.opt.followCircleDirection = +1;
		}
	}

	// returns a point on snake's body on given length from the head
	// assumes that this.pts is populated
	smoothPoint(t: number): Point {
		const bodyPoints = this.#bodyPoints;

		// range check
		if (t >= this.#len) {
			const tail = bodyPoints[bodyPoints.length - 1];
			return {
				x: tail.x,
				y: tail.y,
			};
		}
		if (t <= 0) {
			return {
				x: bodyPoints[0].x,
				y: bodyPoints[0].y,
			};
		}

		// binary search
		let p = 0;
		let q = bodyPoints.length - 1;
		while (q - p > 1) {
			const m = Math.round((p + q) / 2);
			if (t > bodyPoints[m].len) {
				p = m;
			} else {
				q = m;
			}
		}

		// now q = p + 1, and the point is in between;
		// compute approximation
		const wp = bodyPoints[q].len - t;
		const wq = t - bodyPoints[p].len;
		const w = wp + wq;
		return {
			x: (wp * bodyPoints[p].x + wq * bodyPoints[q].x) / w,
			y: (wp * bodyPoints[p].y + wq * bodyPoints[q].y) / w,
		};
	}

	// finds a point on snake's body closest to the head;
	// returns length from the head
	// excludes points close to the head
	closestBodyPoint(): number {
		const bodyPoints = this.#bodyPoints;
		const ptsLength = bodyPoints.length;

		// skip head area
		let start_n = 0;
		let start_d2 = 0.0;
		for (;;) {
			const prev_d2 = start_d2;
			start_n++;
			start_d2 = getDistance2(
				this.#x,
				this.#y,
				bodyPoints[start_n].x,
				bodyPoints[start_n].y,
			);
			if (start_d2 < prev_d2 || start_n === ptsLength - 1) {
				break;
			}
		}

		if (start_n >= ptsLength || start_n <= 1) {
			return this.#len;
		}

		// find closets point in this.pts
		let min_n = start_n;
		let min_d2 = start_d2;
		for (let n = min_n + 1; n < ptsLength; n++) {
			const d2 = getDistance2(
				this.#x,
				this.#y,
				bodyPoints[n].x,
				bodyPoints[n].y,
			);
			if (d2 < min_d2) {
				min_n = n;
				min_d2 = d2;
			}
		}

		// find second closest point
		let next_n = min_n;
		let next_d2 = min_d2;
		if (min_n === ptsLength - 1) {
			next_n = min_n - 1;
			next_d2 = getDistance2(
				this.#x,
				this.#y,
				bodyPoints[next_n].x,
				bodyPoints[next_n].y,
			);
		} else {
			const d2m = getDistance2(
				this.#x,
				this.#y,
				bodyPoints[min_n - 1].x,
				bodyPoints[min_n - 1].y,
			);
			const d2p = getDistance2(
				this.#x,
				this.#y,
				bodyPoints[min_n + 1].x,
				bodyPoints[min_n + 1].y,
			);
			if (d2m < d2p) {
				next_n = min_n - 1;
				next_d2 = d2m;
			} else {
				next_n = min_n + 1;
				next_d2 = d2p;
			}
		}

		// compute approximation
		let t2 = bodyPoints[min_n].len - bodyPoints[next_n].len;
		t2 *= t2;

		if (t2 === 0) {
			return bodyPoints[min_n].len;
		}
		const min_w = t2 - (min_d2 - next_d2);
		const next_w = t2 + (min_d2 - next_d2);
		return (
			(bodyPoints[min_n].len * min_w + bodyPoints[next_n].len * next_w) /
			(2 * t2)
		);
	}

	bodyDangerZone(
		offset: number,
		targetPoint: Point,
		targetPointNormal: Point,
		closePointDist: number,
		pastTargetPoint: Point,
		closePoint: Point,
	): PolyBox {
		const o = this.opt.followCircleDirection;
		const pts: Point[] = [
			{
				x: this.#x - o * offset * this.#sin,
				y: this.#y + o * offset * this.#cos,
			},
			{
				x:
					this.#x +
					this.#width * this.#cos +
					offset * (this.#cos - o * this.#sin),
				y:
					this.#y +
					this.#width * this.#sin +
					offset * (this.#sin + o * this.#cos),
			},
			{
				x:
					this.#x +
					1.75 * this.#width * this.#cos +
					o * 0.3 * this.#width * this.#sin +
					offset * (this.#cos - o * this.#sin),
				y:
					this.#y +
					1.75 * this.#width * this.#sin -
					o * 0.3 * this.#width * this.#cos +
					offset * (this.#sin + o * this.#cos),
			},
			{
				x:
					this.#x +
					2.5 * this.#width * this.#cos +
					o * 0.7 * this.#width * this.#sin +
					offset * (this.#cos - o * this.#sin),
				y:
					this.#y +
					2.5 * this.#width * this.#sin -
					o * 0.7 * this.#width * this.#cos +
					offset * (this.#sin + o * this.#cos),
			},
			{
				x:
					this.#x +
					3 * this.#width * this.#cos +
					o * 1.2 * this.#width * this.#sin +
					offset * this.#cos,
				y:
					this.#y +
					3 * this.#width * this.#sin -
					o * 1.2 * this.#width * this.#cos +
					offset * this.#sin,
			},
			{
				x:
					targetPoint.x +
					targetPointNormal.x * (offset + 0.5 * Math.max(closePointDist, 0)),
				y:
					targetPoint.y +
					targetPointNormal.y * (offset + 0.5 * Math.max(closePointDist, 0)),
			},
			{
				x: pastTargetPoint.x + targetPointNormal.x * offset,
				y: pastTargetPoint.y + targetPointNormal.y * offset,
			},
			pastTargetPoint,
			targetPoint,
			closePoint,
		];

		return addPolyBox({
			pts: convexHull(pts),
		});
	}

	constructInsidePolygon(closePointT: number): PolyBox {
		const insidePolygonStartT = 5 * this.#width;
		const insidePolygonEndT = closePointT + 5 * this.#width;
		const insidePolygonPts = [
			this.smoothPoint(insidePolygonEndT),
			this.smoothPoint(insidePolygonStartT),
		];
		for (let t = insidePolygonStartT; t < insidePolygonEndT; t += this.#width) {
			insidePolygonPts.push(this.smoothPoint(t));
		}

		const insidePolygon = addPolyBox({
			pts: insidePolygonPts,
		});

		return insidePolygon;
	}

	followCircleSelf(): void {
		this.populatePts();
		this.determineCircleDirection();
		const o = this.opt.followCircleDirection;

		// exit if too short
		if (this.#len < 9 * this.#width) {
			return;
		}

		const closePointT = this.closestBodyPoint();
		const closePoint = this.smoothPoint(closePointT);

		// approx tangent and normal vectors and closePoint
		const closePointNext = this.smoothPoint(closePointT - this.#width);
		const closePointTangent = unitVector({
			x: closePointNext.x - closePoint.x,
			y: closePointNext.y - closePoint.y,
		});
		const closePointNormal = {
			x: -o * closePointTangent.y,
			y: o * closePointTangent.x,
		};

		// angle wrt closePointTangent
		const currentCourse = Math.asin(
			Math.max(
				-1,
				Math.min(
					1,
					this.#cos * closePointNormal.x + this.#sin * closePointNormal.y,
				),
			),
		);

		// compute (oriented) distance from the body at closePointDist
		const closePointDist =
			(this.#x - closePoint.x) * closePointNormal.x +
			(this.#y - closePoint.y) * closePointNormal.y;

		// construct polygon for snake inside
		const insidePolygon = this.constructInsidePolygon(closePointT);

		// get target point; this is an estimate where we land if we hurry
		let targetPointT = closePointT;
		let targetPointFar = 0.0;
		const targetPointStep = this.#width / 64;
		for (
			let h = closePointDist, a = currentCourse;
			h >= 0.125 * this.#width;
		) {
			targetPointT -= targetPointStep;
			targetPointFar += targetPointStep * Math.cos(a);
			h += targetPointStep * Math.sin(a);
			a = Math.max(-Math.PI / 4, a - targetPointStep / this.#width);
		}

		const targetPoint = this.smoothPoint(targetPointT);

		const pastTargetPointT = targetPointT - 3 * this.#width;
		const pastTargetPoint = this.smoothPoint(pastTargetPointT);

		const offsetIncrement = 0.0625 * this.#width;

		// look for danger from enemies
		let enemyBodyOffsetDelta = 0.25 * this.#width;
		let enemyHeadDist2 = 64 * 64 * this.#width * this.#width;

		for (let i = 0, snakesNum = window.slithers.length; i < snakesNum; i++) {
			const sk = window.slithers[i];

			if (sk.id === this.#id) continue;

			const enemyWidth = this.getSnakeWidth(sk.sc);

			const enemyHead: Point = {
				x: sk.xx,
				y: sk.yy,
			};

			const enemyAhead = {
				x: enemyHead.x + Math.cos(sk.ang) * this.#width,
				y: enemyHead.y + Math.sin(sk.ang) * this.#width,
			};

			// heads
			if (!pointInPoly(enemyHead, insidePolygon)) {
				enemyHeadDist2 = Math.min(
					enemyHeadDist2,
					getDistance2(enemyHead.x, enemyHead.y, targetPoint.x, targetPoint.y),
					getDistance2(
						enemyAhead.x,
						enemyAhead.y,
						targetPoint.x,
						targetPoint.y,
					),
				);
			}

			// bodies
			let offsetSet = false;
			let offset = 0.0;
			let cpolbody: PolyBox = {
				pts: [],
				minx: 0,
				miny: 0,
				maxx: 0,
				maxy: 0,
			};

			const bodyOffset = 0.5 * (this.#width + enemyWidth);
			const pts = sk.pts;
			for (let j = 0, ptsNum = pts.length; j < ptsNum; j++) {
				const po = pts[j];

				if (po == null || po.dying) continue;

				const point: Point = {
					x: po.xx,
					y: po.yy,
				};

				while (
					!offsetSet ||
					(enemyBodyOffsetDelta >= -this.#width && pointInPoly(point, cpolbody))
				) {
					if (!offsetSet) {
						offsetSet = true;
					} else {
						enemyBodyOffsetDelta -= offsetIncrement;
					}
					offset = bodyOffset + enemyBodyOffsetDelta;
					cpolbody = this.bodyDangerZone(
						offset,
						targetPoint,
						closePointNormal,
						closePointDist,
						pastTargetPoint,
						closePoint,
					);
				}
			}
		}

		const intoViewWall = Math.abs(window.flux_grd - window.view_dist) < 1e3;
		let wallOffsetDelta = 0;
		if (intoViewWall) {
			const borderPointWidth = this.#borderPointRadius * 2;
			const radius = window.flux_grd + this.#borderPointRadius;
			const wallOffset = 0.5 * (this.#width + this.#borderPointRadius);
			let offsetSet = !1;
			let offset = 0;
			let cpolbody: PolyBox = {
				pts: [],
				minx: 0,
				miny: 0,
				maxx: 0,
				maxy: 0,
			};

			for (let j = 2, i = -j; i <= j; i++) {
				const wa = window.view_ang + (i * borderPointWidth) / window.flux_grd;
				const wx = window.grd + radius * Math.cos(wa);
				const wy = window.grd + radius * Math.sin(wa);
				const wallPoint: Point = {
					x: wx,
					y: wy,
				};

				while (
					!offsetSet ||
					(wallOffsetDelta >= -this.#width && pointInPoly(wallPoint, cpolbody))
				) {
					if (!offsetSet) {
						offsetSet = !0;
					} else {
						wallOffsetDelta -= offsetIncrement;
					}
					offset = wallOffset + wallOffsetDelta;
					cpolbody = this.bodyDangerZone(
						offset,
						targetPoint,
						closePointNormal,
						closePointDist,
						pastTargetPoint,
						closePoint,
					);
				}
			}
		}

		const enemyHeadDist = Math.sqrt(enemyHeadDist2);

		// mark visualize
		{
			for (
				let i = 0, points = insidePolygon.pts, l = points.length;
				i < l;
				i++
			) {
				visualizer.drawLine(points[i], points[(i + 1) % l], "orange");
			}
			visualizer.drawCircle(
				{
					x: closePoint.x,
					y: closePoint.y,
					r: this.#width * 0.25,
				},
				"green",
			);
			visualizer.drawCircle(
				{
					x: targetPoint.x,
					y: targetPoint.y,
					r: this.#width + 2 * targetPointFar,
				},
				"blue",
			);
			visualizer.drawCircle(
				{
					x: targetPoint.x,
					y: targetPoint.y,
					r: this.#width * 0.2,
				},
				"blue",
			);

			const soffset = 0.5 * this.#width;
			const scpolbody = this.bodyDangerZone(
				soffset,
				targetPoint,
				closePointNormal,
				closePointDist,
				pastTargetPoint,
				closePoint,
			);
			for (let i = 0, points = scpolbody.pts, l = points.length; i < l; i++) {
				visualizer.drawLine(points[i], points[(i + 1) % l], "white");
			}
		}

		// TAKE ACTION

		// expand?
		let targetCourse = currentCourse + 0.25;

		// enemy head nearby?
		let headProx = -1.0 - (2 * targetPointFar - enemyHeadDist) / this.#width;
		if (headProx > 0) {
			headProx = 0.125 * headProx * headProx;
		} else {
			headProx = -0.5 * headProx * headProx;
		}
		targetCourse = Math.min(targetCourse, headProx);

		// enemy body nearby?
		const adjustedBodyOffset =
			(enemyBodyOffsetDelta - 0.0625 * this.#width) / this.#width;
		targetCourse = Math.min(targetCourse, targetCourse + adjustedBodyOffset);

		// wall nearby?
		const adjustedWallOffset =
			(wallOffsetDelta - 0.0625 * this.#width) / this.#width;
		if (intoViewWall) {
			targetCourse = Math.min(targetCourse, targetCourse + adjustedWallOffset);
		}

		// small tail?
		const tailBehind = this.#len - closePointT;

		const targetDir = unitVector({
			x: 0,
			y: 0,
		});
		const driftQ =
			targetDir.x * closePointNormal.x + targetDir.y * closePointNormal.y;
		const allowTail = this.#width * (2 - 0.5 * driftQ);

		targetCourse = Math.min(
			targetCourse,
			(tailBehind - allowTail + (this.#width - closePointDist)) / this.#width,
		);

		// far away?
		targetCourse = Math.min(
			targetCourse,
			(-0.5 * (closePointDist - 4 * this.#width)) / this.#width,
		);

		// final corrections
		// too fast in?
		targetCourse = Math.max(
			targetCourse,
			(-0.75 * closePointDist) / this.#width,
		);

		// too fast out?
		targetCourse = Math.min(targetCourse, 1.0);

		const goalDir = {
			x:
				closePointTangent.x * Math.cos(targetCourse) -
				o * closePointTangent.y * Math.sin(targetCourse),
			y:
				closePointTangent.y * Math.cos(targetCourse) +
				o * closePointTangent.x * Math.sin(targetCourse),
		};

		const goal = {
			x: this.#x + goalDir.x * 4 * this.#width,
			y: this.#y + goalDir.y * 4 * this.#width,
		};

		if (
			Math.abs(goal.x - this.#goalCoordinates.x) < 1000 &&
			Math.abs(goal.y - this.#goalCoordinates.y) < 1000
		) {
			this.#goalCoordinates = {
				x: Math.round(goal.x * 0.25 + this.#goalCoordinates.x * 0.75),
				y: Math.round(goal.y * 0.25 + this.#goalCoordinates.y * 0.75),
			};
		} else {
			this.#goalCoordinates = {
				x: Math.round(goal.x),
				y: Math.round(goal.y),
			};
		}
	}

	// Sorting by property 'score' descending
	sortScore<P extends { score: number } | undefined>(a: P, b: P) {
		if (a === undefined) return 1;
		if (b === undefined) return -1;
		return b.score - a.score;
	}

	// Sorting by property 'sz' descending
	sortSz<P extends { sz: number }>(a: P, b: P) {
		return b.sz - a.sz;
	}

	// Sorting by property 'd2' ascending
	sortDistance<P extends { d2: number }>(a: P, b: P) {
		return a.d2 - b.d2;
	}

	computeFoodGoal(): void {
		this.foodAngles = [];

		for (let i = 0; i < window.foods.length; i++) {
			const fo = window.foods[i];

			if (fo == null || fo.eaten) continue;

			const f: FoodPoint = {
				x: fo.xx,
				y: fo.yy,
				r: 2,
				d2: getDistance2(this.#x, this.#y, fo.xx, fo.yy),
				sz: fo.sz,
			};

			const isInside =
				this.circleIntersect(f, this.#sideCircleL) ||
				this.circleIntersect(f, this.#sideCircleR);

			if (!isInside) {
				this.addFoodAngle(f);
			}
		}

		this.foodAngles.sort(this.sortScore);

		if (this.foodAngles[0] !== undefined && this.foodAngles[0].sz > 0) {
			this.currentFood = this.foodAngles[0];
		} else {
			this.currentFood = undefined;
		}
	}

	toCircle(): void {
		if (!this.#enbaleFollowCircle) return;

		const pts = this.#pts;
		const radius = this.#radius;

		for (let i = 0, e = 0, l = pts.length; i < l; i++) {
			const po = pts[i];

			if (po == null || po.dying) continue;

			// skip head
			if (++e > 20) break;

			const tailCircle: Circle = {
				x: po.xx,
				y: po.yy,
				r: radius,
			};

			visualizer.drawCircle(tailCircle, "blue");

			if (this.circleIntersect(this.#headCircle, tailCircle)) {
				this.stage = "circle";
				return;
			}
		}

		const o = this.opt.followCircleDirection;

		this.onAcceleration(this.defaultAccel);
		this.#goalCoordinates = this.changeHeadingRel((o * Math.PI) / 32);
	}

	delayAction() {
		if (this.#delayFrame === -1) return;

		if (this.#delayFrame > 0) {
			this.#delayFrame--;
			return;
		}

		if (window.playing && window.slither != null) {
			if (this.stage === "grow") {
				this.computeFoodGoal();
				this.#goalCoordinates = this.currentFood ?? {
					x: window.grd,
					y: window.grd,
				};
			} else if (this.stage === "tocircle") {
				this.toCircle();
			}
		}

		this.#delayFrame = -1;
	}

	every(): void {
		if (window.slither == null) return;
		this.#id = window.slither.id;
		this.#x = window.slither.xx;
		this.#y = window.slither.yy;
		this.#ang = window.slither.ang;
		this.#pts = window.slither.pts;
		this.#cos = Math.cos(this.#ang);
		this.#sin = Math.sin(this.#ang);

		this.#speedMult = window.slither.sp / this.opt.speedBase;
		this.#width = this.getSnakeWidth(window.slither.sc);
		this.#radius = this.#width / 2;
		this.#snakeLength = this.getSnakeLength(window.slither);

		this.MAXARC = (2 * Math.PI) / this.opt.arcSize;

		const spFactor = Math.min(1, this.#speedMult - 1) * this.opt.radiusMult;

		this.#headCircle = {
			x: this.#x + ((this.#cos * spFactor) / 2) * this.#radius,
			y: this.#y + ((this.#sin * spFactor) / 2) * this.#radius,
			r: (this.opt.radiusMult / 2) * this.#radius,
		};

		this.#sideCircleR = {
			x: this.#x - (this.#y + this.#sin * this.#width - this.#y),
			y: this.#y + (this.#x + this.#cos * this.#width - this.#x),
			r: this.#width * this.#speedMult,
		};

		this.#sideCircleL = {
			x: this.#x + (this.#y + this.#sin * this.#width - this.#y),
			y: this.#y - (this.#x + this.#cos * this.#width - this.#x),
			r: this.#width * this.#speedMult,
		};

		visualizer.drawCircle(this.#headCircle, "red");
	}

	public go() {
		const ctx = window.mc.getContext("2d");
		if (ctx) visualizer.setContext(ctx);

		this.every();

		// Normal bot behavior
		if (this.#snakeLength < this.opt.followCircleLength) {
			this.stage = "grow";
		}

		if (this.currentFood !== undefined && this.stage !== "grow") {
			this.currentFood = undefined;
		}

		if (this.stage === "circle") {
			this.onAcceleration(this.defaultAccel);
			this.followCircleSelf();
		} else if (this.checkCollision() || this.checkEncircle()) {
			if (this.#delayFrame !== -1) {
				this.#delayFrame = this.opt.collisionDelay;
			}
		} else {
			if (this.#snakeLength > this.opt.followCircleLength) {
				this.stage = "tocircle";
			}

			if (this.#delayFrame === -1) {
				this.#delayFrame = this.opt.actionFrames;
			}

			this.onAcceleration(this.defaultAccel);
		}

		this.delayAction();
		this.onSetCoordinates(this.#goalCoordinates.x, this.#goalCoordinates.y);

		visualizer.drawLine(
			{
				x: this.#x,
				y: this.#y,
			},
			this.#goalCoordinates,
			"green",
		);
		visualizer.drawCircle(
			{
				x: this.#goalCoordinates.x,
				y: this.#goalCoordinates.y,
				r: 5,
			},
			"red",
		);


	}

	public destory() {
		this.#delayFrame = 0;
	}
}
