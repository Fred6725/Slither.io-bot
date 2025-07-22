export interface Point {
	x: number;
	y: number;
}

export interface Circle extends Point {
	r: number;
}

export interface Rect extends Point {
	w: number;
	h: number;
}

export interface Poly {
	pts: Point[];
}

export interface PolyBox extends Poly {
	minx: number;
	maxx: number;
	miny: number;
	maxy: number;
}

export interface IntersectPoint extends Point {
	a: number;
}

export interface OpenAngle {
	openStart: number;
	openEnd: number;
	sz: number;
}

type CollisionPointType = {
	head: 0;
	part: 1;
	wall: 2;
};
interface CollisionPointBase<T extends keyof CollisionPointType> extends Point {
	r: number;
	d2: number;
	si: number;
	type: CollisionPointType[T];
	speed?: number;
}
export interface CollisionPointHead extends CollisionPointBase<"head"> {
	speed: number;
}
export interface CollisionPointPart extends CollisionPointBase<"part"> {}
export interface CollisionPointWall extends CollisionPointBase<"wall"> {}

export type CollisionPoint =
	| CollisionPointHead
	| CollisionPointPart
	| CollisionPointWall;

export interface CollisionAngle extends Point {
	r: number;
	d2: number;
	si: number;
	ang: number;
	aIndex: number;
}

interface FoodPointBase extends Point, Circle {
	r: number;
	d2: number;
	sz: number;
}
export type FoodPoint = FoodPointBase;
export interface FoodAngle extends Point {
	ang: number;
	da: number;
	d2: number;
	sz: number;
	score: number;
}

export interface BodyPoint extends Point {
	len: number;
}

// NEW: Enhanced prediction types for god mode
export interface TrajectoryPoint extends Point {
	time: number;
	angle: number;
	speed: number;
}

export interface SnakeTrajectory {
	snakeId: number;
	trajectory: TrajectoryPoint[];
	predictedCollisionTime?: number;
	collisionPoint?: Point;
}

export interface ThreatAnalysis {
	snakeId: number;
	threatLevel: number; // 0-1 scale
	timeToCollision: number; // frames until collision
	avoidanceAngle: number; // optimal angle to avoid
	priority: number; // processing priority
}

export interface KillOpportunity {
	targetSnakeId: number;
	interceptPoint: Point;
	interceptTime: number;
	successProbability: number;
	requiredTrajectory: TrajectoryPoint[];
}

export interface GodModeState {
	enabled: boolean;
	collisionPredictionFrames: number;
	emergencyAvoidanceActive: boolean;
	lastEmergencyTime: number;
	threatAnalyses: ThreatAnalysis[];
	killOpportunities: KillOpportunity[];
}
