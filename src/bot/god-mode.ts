import type { ISlither } from "../slither/interface";

interface Point {
	x: number;
	y: number;
}

interface Obstacle {
	x: number;
	y: number;
	radius: number;
	speed: number;
	angle: number;
	distance: number;
}

interface CollisionPrediction {
	willCollide: boolean;
	timeToCollision: number;
	collisionPoint: Point;
	requiredAvoidanceAngle: number;
	obstacle: Obstacle;
}

/**
 * PHYSICS-BASED GOD MODE ASSIST
 * 
 * Core Principles:
 * 1. Find CLOSEST obstacle only
 * 2. Calculate exact collision using physics (position, speed, angle, size)
 * 3. Apply FULL steering at last moment
 * 4. Result: follow detected obstacle parallel
 * 5. User keeps full boost control
 */
export class GodModeAssist {
	private enabled = false;
	private visualsEnabled = false;
	private takingControl = false;
	private lastControlTime = 0;

	// Physics constants - systematic and fair
	private opt = {
		// Base detection - only closest obstacle matters
		baseDetectionDistance: 120,
		
		// Angle multiplier: 90° = 1x, 0°/180° = 2x (head-on worst case)
		getAngleMultiplier: (angleDiff: number): number => {
			// Convert to 0-180° range
			const absAngle = Math.abs(angleDiff);
			const normalizedAngle = Math.min(absAngle, Math.PI - absAngle);
			// 90° (PI/2) = 1x, 0° = 2x
			return 1 + (Math.PI/2 - normalizedAngle) / (Math.PI/2);
		},
		
		// Boost multiplier: no boost = 1x, boost = 3.5x
		boostMultiplier: 3.5,
		
		// Control settings
		controlCooldown: 10, // frames
		fullSteeringAmount: Math.PI * 0.7, // 126° - full steering
	};

	public isEnabled(): boolean {
		return this.enabled;
	}

	public setEnabled(enabled: boolean): void {
		this.enabled = enabled;
		if (!enabled) {
			this.takingControl = false;
		}
	}

	public setVisualsEnabled(enabled: boolean): void {
		this.visualsEnabled = enabled;
	}

	public isVisualsEnabled(): boolean {
		return this.visualsEnabled;
	}

	/**
	 * Main assist function - check for collision and take control if needed
	 */
	public checkAndAssist(ourSnake: ISlither): boolean {
		if (!this.enabled || !ourSnake || !window.slithers) {
			return false;
		}

		// Cooldown check
		const now = window.timeObj ? window.timeObj.now() : Date.now();
		if (now - this.lastControlTime < this.opt.controlCooldown) {
			return this.takingControl;
		}

		// Find closest obstacle
		const closestObstacle = this.findClosestObstacle(ourSnake);
		if (!closestObstacle) {
			this.takingControl = false;
			return false;
		}

		// Predict collision using exact physics
		const prediction = this.predictCollision(ourSnake, closestObstacle);
		
		if (prediction.willCollide) {
			this.takeControlAndAvoid(ourSnake, prediction);
			return true;
		}

		this.takingControl = false;
		return false;
	}

	/**
	 * Find the single closest obstacle (head or body segment)
	 */
	private findClosestObstacle(ourSnake: ISlither): Obstacle | null {
		let closest: Obstacle | null = null;
		let closestDistance = Infinity;

		// Our snake properties
		const ourX = ourSnake.xx;
		const ourY = ourSnake.yy;
		const ourSpeed = ourSnake.sp;
		const ourAngle = ourSnake.ang;
		const ourIsBoosting = ourSpeed > 6;

		for (let i = 0; i < window.slithers.length; i++) {
			const snake = window.slithers[i];
			if (!snake || snake.id === ourSnake.id || snake.dead) continue;

			const enemySpeed = snake.sp;
			const enemyAngle = snake.ang;
			const enemyRadius = Math.round(snake.sc * 29) / 2;
			const enemyIsBoosting = enemySpeed > 6;

			// Check head
			const headDistance = Math.sqrt((ourX - snake.xx) ** 2 + (ourY - snake.yy) ** 2);
			
			// Calculate systematic detection distance
			const angleDiff = Math.abs(ourAngle - enemyAngle);
			const angleMultiplier = this.opt.getAngleMultiplier(angleDiff);
			const boostMultiplier = (ourIsBoosting ? this.opt.boostMultiplier : 1) * 
									(enemyIsBoosting ? this.opt.boostMultiplier : 1);
			const detectionDistance = this.opt.baseDetectionDistance * angleMultiplier * boostMultiplier;

			if (headDistance < detectionDistance && headDistance < closestDistance) {
				closest = {
					x: snake.xx,
					y: snake.yy,
					radius: enemyRadius,
					speed: enemySpeed,
					angle: enemyAngle,
					distance: headDistance
				};
				closestDistance = headDistance;
			}

			// Check body segments
			if (snake.pts) {
				for (const pt of snake.pts) {
					if (!pt || pt.dying) continue;
					
					const bodyDistance = Math.sqrt((ourX - pt.xx) ** 2 + (ourY - pt.yy) ** 2);
					
					if (bodyDistance < detectionDistance && bodyDistance < closestDistance) {
						closest = {
							x: pt.xx,
							y: pt.yy,
							radius: enemyRadius,
							speed: 0, // Body segments don't move independently
							angle: 0,
							distance: bodyDistance
						};
						closestDistance = bodyDistance;
					}
				}
			}
		}

		return closest;
	}

	/**
	 * Predict collision using exact physics
	 */
	private predictCollision(ourSnake: ISlither, obstacle: Obstacle): CollisionPrediction {
		// Our snake properties
		const ourX = ourSnake.xx;
		const ourY = ourSnake.yy;
		const ourSpeed = ourSnake.sp;
		const ourAngle = ourSnake.ang;
		const ourRadius = Math.round(ourSnake.sc * 29) / 2;

		// Our velocity components
		const ourVx = Math.cos(ourAngle) * ourSpeed;
		const ourVy = Math.sin(ourAngle) * ourSpeed;

		// Obstacle velocity components (if moving)
		const obsVx = Math.cos(obstacle.angle) * obstacle.speed;
		const obsVy = Math.sin(obstacle.angle) * obstacle.speed;

		// Relative position and velocity
		const relX = obstacle.x - ourX;
		const relY = obstacle.y - ourY;
		const relVx = obsVx - ourVx;
		const relVy = obsVy - ourVy;

		// Combined collision radius (our head center to their edge)
		const collisionRadius = ourRadius + obstacle.radius;

		// Quadratic equation: at² + bt + c = 0
		const a = relVx * relVx + relVy * relVy;
		const b = 2 * (relX * relVx + relY * relVy);
		const c = relX * relX + relY * relY - collisionRadius * collisionRadius;

		// Solve quadratic equation
		if (a === 0) {
			// No relative movement - static collision check
			return {
				willCollide: c <= 0,
				timeToCollision: 0,
				collisionPoint: { x: obstacle.x, y: obstacle.y },
				requiredAvoidanceAngle: this.calculateAvoidanceAngle(ourSnake, obstacle),
				obstacle
			};
		}

		const discriminant = b * b - 4 * a * c;
		if (discriminant < 0) {
			// No collision
			return {
				willCollide: false,
				timeToCollision: Infinity,
				collisionPoint: { x: 0, y: 0 },
				requiredAvoidanceAngle: 0,
				obstacle
			};
		}

		const t1 = (-b - Math.sqrt(discriminant)) / (2 * a);
		const t2 = (-b + Math.sqrt(discriminant)) / (2 * a);

		// We want the earliest positive time
		let timeToCollision = Infinity;
		if (t1 > 0) timeToCollision = t1;
		else if (t2 > 0) timeToCollision = t2;

		const willCollide = timeToCollision < 60; // 1 second at 60fps

		// Calculate collision point
		const collisionPoint = {
			x: ourX + ourVx * timeToCollision,
			y: ourY + ourVy * timeToCollision
		};

		return {
			willCollide,
			timeToCollision,
			collisionPoint,
			requiredAvoidanceAngle: this.calculateAvoidanceAngle(ourSnake, obstacle),
			obstacle
		};
	}

	/**
	 * Calculate the exact avoidance angle for full steering
	 */
	private calculateAvoidanceAngle(ourSnake: ISlither, obstacle: Obstacle): number {
		// Vector from us to obstacle
		const toObstacle = Math.atan2(obstacle.y - ourSnake.yy, obstacle.x - ourSnake.xx);
		
		// Current angle difference
		const angleDiff = toObstacle - ourSnake.ang;
		const normalizedDiff = ((angleDiff + Math.PI) % (2 * Math.PI)) - Math.PI;
		
		// Full steering in the direction that avoids the obstacle
		const steeringDirection = normalizedDiff > 0 ? -1 : 1;
		
		return ourSnake.ang + steeringDirection * this.opt.fullSteeringAmount;
	}

	/**
	 * Take control and apply avoidance - NO BOOST INTERFERENCE
	 */
	private takeControlAndAvoid(ourSnake: ISlither, prediction: CollisionPrediction): void {
		this.takingControl = true;
		this.lastControlTime = window.timeObj ? window.timeObj.now() : Date.now();

		console.log(`🚨 GOD MODE: Avoiding obstacle at ${prediction.obstacle.distance.toFixed(0)}px, Time: ${prediction.timeToCollision.toFixed(1)}f`);

		// Apply FULL steering correction
		this.setMouseDirection(prediction.requiredAvoidanceAngle);

		// NO boost interference - user has total control
	}

	/**
	 * Set mouse direction for steering
	 */
	private setMouseDirection(targetAngle: number): void {
		if (!window.ourSnake) return;

		// Convert to screen coordinates for mouse positioning
		const mouseDistance = 200; // Distance from snake center
		const targetX = window.ourSnake.xx + Math.cos(targetAngle) * mouseDistance;
		const targetY = window.ourSnake.yy + Math.sin(targetAngle) * mouseDistance;

		// Convert to canvas coordinates
		const canvasX = (targetX - window.view_xx) * window.gsc + window.canvas.width / 2;
		const canvasY = (targetY - window.view_yy) * window.gsc + window.canvas.height / 2;

		// Set mouse position
		window.xm = canvasX;
		window.ym = canvasY;
	}

	/**
	 * Visual debugging
	 */
	public drawVisuals(): void {
		if (!this.visualsEnabled || !window.ctx || !window.ourSnake) return;

		const ctx = window.ctx;
		const ourSnake = window.ourSnake;

		// Map our snake to canvas
		const snakeScreen = {
			x: (ourSnake.xx - window.view_xx) * window.gsc + window.canvas.width / 2,
			y: (ourSnake.yy - window.view_yy) * window.gsc + window.canvas.height / 2
		};

		// Find closest obstacle for display
		const closest = this.findClosestObstacle(ourSnake);
		if (closest) {
			const prediction = this.predictCollision(ourSnake, closest);
			
			// Draw detection radius
			const detectionRadius = this.opt.baseDetectionDistance * window.gsc;
			ctx.strokeStyle = prediction.willCollide ? '#ff0000' : '#ffff00';
			ctx.lineWidth = 2;
			ctx.beginPath();
			ctx.arc(snakeScreen.x, snakeScreen.y, detectionRadius, 0, 2 * Math.PI);
			ctx.stroke();

			// Draw closest obstacle
			const obstacleScreen = {
				x: (closest.x - window.view_xx) * window.gsc + window.canvas.width / 2,
				y: (closest.y - window.view_yy) * window.gsc + window.canvas.height / 2
			};
			
			ctx.fillStyle = prediction.willCollide ? '#ff0000' : '#00ff00';
			ctx.beginPath();
			ctx.arc(obstacleScreen.x, obstacleScreen.y, 8, 0, 2 * Math.PI);
			ctx.fill();

			// Draw trajectory line
			if (prediction.willCollide) {
				ctx.strokeStyle = '#ff00ff';
				ctx.lineWidth = 3;
				ctx.beginPath();
				ctx.moveTo(snakeScreen.x, snakeScreen.y);
				
				const avoidanceScreen = {
					x: snakeScreen.x + Math.cos(prediction.requiredAvoidanceAngle) * 100,
					y: snakeScreen.y + Math.sin(prediction.requiredAvoidanceAngle) * 100
				};
				
				ctx.lineTo(avoidanceScreen.x, avoidanceScreen.y);
				ctx.stroke();
			}
		}

		// Debug info
		ctx.fillStyle = '#ffffff';
		ctx.font = '12px Arial';
		ctx.fillText(`GOD MODE: ${this.enabled ? 'ON' : 'OFF'}`, 10, 30);
		ctx.fillText(`Control: ${this.takingControl ? 'ACTIVE' : 'Monitoring'}`, 10, 50);
		
		if (closest) {
			ctx.fillText(`Closest: ${closest.distance.toFixed(0)}px`, 10, 70);
		}
	}
}
