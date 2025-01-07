import type { Circle, Point, Rect } from "./types";

const TAU = 2 * Math.PI;

const roundedPoint = (point: Point): Point => ({
	x: Math.round(point.x),
	y: Math.round(point.y),
});

const roundedCircle = (circle: Circle): Circle => ({
	x: Math.round(circle.x),
	y: Math.round(circle.y),
	r: Math.round(circle.r),
});

const roundedRect = (rect: Rect): Rect => ({
	x: Math.round(rect.x),
	y: Math.round(rect.y),
	w: Math.round(rect.w),
	h: Math.round(rect.h),
});

const scaled = (scalar: number): number => scalar * window.gsc;

const mapToCanvas = (point: Point): Point => ({
	x: window.mww2 + scaled(point.x - window.view_xx),
	y: window.mhh2 + scaled(point.y - window.view_yy),
});

const getContext = (
	canvas = document.createElement("canvas"),
): CanvasRenderingContext2D => {
	const ctx = canvas.getContext("2d");
	if (ctx === null) {
		throw new Error("Failed to get canvas context");
	}
	return ctx;
};

/**
 * This file contains a class that provides a simple API for drawing shapes on a canvas.
 * It is used to visualize the bot's behavior.
 */
export class Visualizer {
	enabled = true;
	ctx: CanvasRenderingContext2D;

	constructor(ctx = getContext()) {
		this.ctx = ctx;
	}

	setContext(ctx: CanvasRenderingContext2D): void {
		this.ctx = ctx;
	}

	drawLine(start: Point, end: Point, color: string, width = 2): void {
		if (!this.enabled) return;

		const ctx = this.ctx;
		const p1 = roundedPoint(mapToCanvas(start));
		const p2 = roundedPoint(mapToCanvas(end));
		const w = scaled(width);

		ctx.save();
		ctx.lineWidth = w;
		ctx.strokeStyle = color;
		ctx.beginPath();
		ctx.moveTo(p1.x, p1.y);
		ctx.lineTo(p2.x, p2.y);
		ctx.stroke();
		ctx.restore();
	}

	drawCircle(circle: Circle, color: string, fill = false, alpha = 1): void {
		if (!this.enabled) return;

		const ctx = this.ctx;
		const p = mapToCanvas(circle);
		const { x, y, r } = roundedCircle({
			x: p.x,
			y: p.y,
			r: scaled(circle.r),
		});

		ctx.save();
		ctx.globalAlpha = alpha;
		ctx.strokeStyle = color;
		ctx.beginPath();
		ctx.arc(x, y, r, 0, TAU);
		if (fill) {
			ctx.fillStyle = color;
			ctx.fill();
		}
		ctx.stroke();
		ctx.restore();
	}

	drawRect(rect: Rect, color: string, fill = false, alpha = 1): void {
		if (!this.enabled) return;

		const ctx = this.ctx;
		const p = mapToCanvas(rect);
		const { x, y, w, h } = roundedRect({
			x: p.x,
			y: p.y,
			w: scaled(rect.w),
			h: scaled(rect.h),
		});

		ctx.save();
		ctx.globalAlpha = alpha;
		ctx.strokeStyle = color;
		if (fill) {
			ctx.fillStyle = color;
			ctx.fillRect(x, y, w, h);
		}
		ctx.strokeRect(x, y, w, h);
		ctx.restore();
	}
}
