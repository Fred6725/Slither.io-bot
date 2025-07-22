import type { ISlither } from "../slither/interface";
import { fastAtan2, getDistance2 } from "./canvas";
import type {
	Point,
	TrajectoryPoint,
	SnakeTrajectory,
	ThreatAnalysis,
	KillOpportunity,
	GodModeState,
} from "./types";

/**
 * God Mode - Standalone assist system that takes control only when player is in danger
 * Works independently from the bot and provides emergency collision avoidance
 */
export class GodModeAssist {
	private state: GodModeState = {
		enabled: false,
		collisionPredictionFrames: 20, // Reduced for more responsive detection
		emergencyAvoidanceActive: false,
		lastEmergencyTime: 0,
		threatAnalyses: [],
		killOpportunities: [],
	};

	private visualsEnabled = false;
	private lastControlTime = 0;
	private originalMouseControl: ((e: MouseEvent) => void) | null = null;

	public opt = {
		// Detection settings - tuned for real physics
		predictionFrames: 60,           // 1 second lookahead at 60fps
		dangerRadius: 80,               // Reasonable detection radius
		emergencyRadius: 40,            // Emergency response distance
		
		// Response settings - precise control
		maxThreatLevel: 0.4,           // Activate when 40% threat or higher
		controlCooldown: 15,           // Prevent rapid takeovers
		minControlDuration: 10,        // Hold control long enough to complete maneuver
		
		// Physics settings
		speedBoostThreshold: 0.8,      // Boost when 80% threat or higher
		tightSpaceThreshold: 80,       // Distance threshold for tight space detection
	};

	public isEnabled(): boolean {
		return this.state.enabled;
	}

	public setEnabled(enabled: boolean): void {
		this.state.enabled = enabled;
		console.log(`God Mode Assist: ${enabled ? 'ENABLED' : 'DISABLED'}`);
		if (!enabled) {
			this.state.emergencyAvoidanceActive = false;
			this.state.threatAnalyses = [];
			this.state.killOpportunities = [];
			this.releaseControl();
		}
	}

	public setVisualsEnabled(enabled: boolean): void {
		this.visualsEnabled = enabled;
		console.log(`God Mode Visuals: ${enabled ? 'ENABLED' : 'DISABLED'}`);
	}

	public isVisualsEnabled(): boolean {
		return this.visualsEnabled;
	}

	private predictSnakeTrajectory(snake: ISlither, frames: number): TrajectoryPoint[] {
		const trajectory: TrajectoryPoint[] = [];
		let x = snake.xx;
		let y = snake.yy;
		let angle = snake.ang;
		const speed = snake.sp;

		for (let frame = 0; frame < frames; frame++) {
			const cos = Math.cos(angle);
			const sin = Math.sin(angle);
			
			x += speed * cos;
			y += speed * sin;

			trajectory.push({
				x,
				y,
				time: frame,
				angle,
				speed,
			});

			angle += (Math.random() - 0.5) * 0.1;
		}

		return trajectory;
	}

	/**
	 * Get collision points using the bot's proven method
	 */
	private getCollisionPointsLikeBoot(ourSnake: ISlither): Array<{
		x: number;
		y: number;
		r: number;
		d2: number;
		si: number;
		type: number;
		speed?: number;
	}> {
		const collisionPoints: Array<{
			x: number;
			y: number;
			r: number;
			d2: number;
			si: number;
			type: number;
			speed?: number;
		}> = [];

		// Use bot's width calculation
		const ourWidth = Math.round(ourSnake.sc * 29);
		const farCollisionD2 = (ourWidth * 50) ** 2;

		for (let i = 0; i < window.slithers.length; i++) {
			if (window.slithers[i].id === ourSnake.id) continue;

			const s = window.slithers[i];
			if (!s || s.dead) continue;

			const sRadius = Math.round(s.sc * 29) / 2;

			// Add head collision point
			const headD2 = getDistance2(ourSnake.xx, ourSnake.yy, s.xx, s.yy);
			if (headD2 < this.opt.dangerRadius * this.opt.dangerRadius * 4) { // Wider detection
				collisionPoints.push({
					x: s.xx,
					y: s.yy,
					r: sRadius,
					d2: headD2,
					si: i,
					type: 0, // head
					speed: s.sp,
				});
			}

			// Add body collision points
			const pts = s.pts;
			if (pts) {
				for (let j = 0; j < pts.length; j++) {
					const po = pts[j];
					if (!po || po.dying) continue;

					const pd2 = getDistance2(ourSnake.xx, ourSnake.yy, po.xx, po.yy);
					
					// Use wider detection radius for body segments
					if (pd2 < this.opt.dangerRadius * this.opt.dangerRadius * 4) {
						collisionPoints.push({
							x: po.xx,
							y: po.yy,
							r: sRadius,
							d2: pd2,
							si: i,
							type: 1, // body
						});
					}
				}
			}
		}

		return collisionPoints;
	}

	/**
	 * Analyzes collision point with trajectory prediction
	 */
	private analyzeCollisionPointWithTrajectory(
		ourSnake: ISlither,
		cp: { x: number; y: number; r: number; d2: number; si: number; type: number; speed?: number }
	): ThreatAnalysis | null {
		const ourX = ourSnake.xx;
		const ourY = ourSnake.yy;
		const ourAngle = ourSnake.ang;
		const ourSpeed = ourSnake.sp;

		// Calculate our trajectory
		const ourVx = ourSpeed * Math.cos(ourAngle);
		const ourVy = ourSpeed * Math.sin(ourAngle);

		// Calculate target velocity (heads move, bodies don't)
		let targetVx = 0;
		let targetVy = 0;
		if (cp.type === 0 && cp.speed) {
			// For heads, get the snake's movement
			const targetSnake = window.slithers[cp.si];
			if (targetSnake) {
				targetVx = cp.speed * Math.cos(targetSnake.ang);
				targetVy = cp.speed * Math.sin(targetSnake.ang);
			}
		}

		// Calculate time to collision using trajectory intersection
		const timeToCollision = this.calculateTimeToCollision(
			{ x: ourX, y: ourY, vx: ourVx, vy: ourVy },
			{ x: cp.x, y: cp.y, vx: targetVx, vy: targetVy },
			cp.r + 15 // collision radius (target radius + our radius)
		);

		if (timeToCollision <= 0 || timeToCollision > 120) return null; // 2 seconds max

		// Calculate threat level based on time and approach angle
		const threatLevel = Math.max(0, Math.min(1, 1 - timeToCollision / 60));
		
		// Check if we're actually heading toward collision
		const angleToTarget = Math.atan2(cp.y - ourY, cp.x - ourX);
		const angleDifference = Math.abs(ourAngle - angleToTarget);
		const normalizedAngleDiff = Math.min(angleDifference, 2 * Math.PI - angleDifference);
		
		// Only consider if we're heading somewhat toward the collision
		if (normalizedAngleDiff > Math.PI / 2) return null;

		// Calculate avoidance angle based on approach angle
		const avoidanceAngle = this.calculateSmartAvoidanceAngle(
			ourSnake,
			{ x: cp.x, y: cp.y },
			normalizedAngleDiff,
			threatLevel
		);

		return {
			snakeId: cp.si,
			threatLevel,
			timeToCollision,
			avoidanceAngle,
			priority: threatLevel * (1 / Math.max(timeToCollision, 1)),
		};
	}

	/**
	 * Simplified time-to-collision calculation
	 */
	private calculateTimeToCollision(
		obj1: { x: number; y: number; vx: number; vy: number },
		obj2: { x: number; y: number; vx: number; vy: number },
		collisionRadius: number
	): number {
		// Relative position and velocity
		const dx = obj2.x - obj1.x;
		const dy = obj2.y - obj1.y;
		const dvx = obj2.vx - obj1.vx;
		const dvy = obj2.vy - obj1.vy;
		
		// Quadratic equation coefficients: |pos + vel*t|² = radius²
		const a = dvx * dvx + dvy * dvy;
		const b = 2 * (dx * dvx + dy * dvy);
		const c = dx * dx + dy * dy - collisionRadius * collisionRadius;
		
		// If no relative motion, check current distance
		if (Math.abs(a) < 0.001) {
			const currentDistance = Math.sqrt(dx * dx + dy * dy);
			return currentDistance <= collisionRadius ? 0 : -1;
		}
		
		// Solve quadratic equation
		const discriminant = b * b - 4 * a * c;
		if (discriminant < 0) return -1; // No collision
		
		const sqrtDiscriminant = Math.sqrt(discriminant);
		const t1 = (-b - sqrtDiscriminant) / (2 * a);
		const t2 = (-b + sqrtDiscriminant) / (2 * a);
		
		// Return the first positive collision time
		if (t1 > 0) return t1;
		if (t2 > 0) return t2;
		return -1; // Collision in the past
	}

	/**
	 * Calculates smart avoidance angle based on approach angle and boost state
	 */
	private calculateSmartAvoidanceAngle(
		ourSnake: ISlither,
		targetPoint: Point,
		approachAngle: number,
		threatLevel: number
	): number {
		const ourAngle = ourSnake.ang;
		const ourSpeed = ourSnake.sp;
		
		// Determine if we're boosting (affects turning capability)
		const isBoosting = ourSpeed > 6;
		const boostMultiplier = isBoosting ? 0.6 : 1.0; // Less agile when boosting
		
		// Calculate correction based on approach angle
		let correctionMagnitude: number;
		
		if (approachAngle > Math.PI * 0.7) {
			// 90° approach - sharp turn needed
			correctionMagnitude = Math.PI * 0.5; // 90° turn
		} else if (approachAngle > Math.PI * 0.4) {
			// Medium angle - moderate turn
			correctionMagnitude = Math.PI * 0.3; // 54° turn
		} else {
			// Shallow angle - gentle correction
			correctionMagnitude = Math.PI * 0.15; // 27° turn
		}
		
		// Apply boost limitation and urgency scaling
		correctionMagnitude *= boostMultiplier * (0.7 + threatLevel * 0.3);
		
		// Determine turn direction based on which side of target we're on
		const targetAngle = Math.atan2(targetPoint.y - ourSnake.yy, targetPoint.x - ourSnake.xx);
		const angleDiff = ourAngle - targetAngle;
		const normalizedDiff = ((angleDiff + Math.PI) % (2 * Math.PI)) - Math.PI;
		
		// Turn away from target
		const turnDirection = normalizedDiff > 0 ? 1 : -1;
		
		// Calculate final angle
		return ourAngle + turnDirection * correctionMagnitude;
	}

	/**
	 * Determines the best turn direction considering space availability
	 */
	private determineBestTurnDirection(
		ourSnake: ISlither, 
		collisionPoint: Point, 
		correctionAngle: number
	): number {
		const ourX = ourSnake.xx;
		const ourY = ourSnake.yy;
		const ourAngle = ourSnake.ang;
		
		// Test both turn directions
		const leftAngle = ourAngle + correctionAngle;
		const rightAngle = ourAngle - correctionAngle;
		
		// Check available space in both directions
		const leftSpace = this.calculateAvailableSpace(ourSnake, leftAngle);
		const rightSpace = this.calculateAvailableSpace(ourSnake, rightAngle);
		
		// Choose direction with more space, or away from collision if equal
		if (Math.abs(leftSpace - rightSpace) < 20) {
			// Similar space - turn away from collision point
			const toCollision = { x: collisionPoint.x - ourX, y: collisionPoint.y - ourY };
			const ourDirection = { x: Math.cos(ourAngle), y: Math.sin(ourAngle) };
			const crossProduct = ourDirection.x * toCollision.y - ourDirection.y * toCollision.x;
			return crossProduct > 0 ? -1 : 1; // Turn away from collision
		} else {
			return leftSpace > rightSpace ? 1 : -1; // Turn toward more space
		}
	}

	/**
	 * Calculates available space in a given direction
	 */
	private calculateAvailableSpace(ourSnake: ISlither, testAngle: number): number {
		const ourX = ourSnake.xx;
		const ourY = ourSnake.yy;
		const testDistance = 100; // Look ahead distance
		
		const testX = ourX + Math.cos(testAngle) * testDistance;
		const testY = ourY + Math.sin(testAngle) * testDistance;
		
		let minDistance = testDistance;
		
		// Check distance to all other snakes
		if (window.slithers) {
			for (let i = 0; i < window.slithers.length; i++) {
				const snake = window.slithers[i];
				if (!snake || snake.id === ourSnake.id || snake.dead) continue;
				
				// Check distance to head
				const headDist = Math.sqrt(getDistance2(testX, testY, snake.xx, snake.yy));
				minDistance = Math.min(minDistance, headDist);
				
				// Check distance to body
				if (snake.pts) {
					for (const pt of snake.pts) {
						if (pt && !pt.dying) {
							const bodyDist = Math.sqrt(getDistance2(testX, testY, pt.xx, pt.yy));
							minDistance = Math.min(minDistance, bodyDist);
						}
					}
				}
			}
		}
		
		return minDistance;
	}

	/**
	 * Main assist function - analyzes threats and takes control if necessary
	 * Uses bot's proven collision detection with trajectory prediction
	 */
	public checkAndAssist(ourSnake: ISlither): boolean {
		if (!this.state.enabled || !ourSnake || !window.playing) {
			return false;
		}

		// Get collision points using bot's method
		const collisionPoints = this.getCollisionPointsLikeBoot(ourSnake);
		const threats: ThreatAnalysis[] = [];
		const currentTime = window.timeObj ? window.timeObj.now() : Date.now();

		// Analyze each collision point for trajectory collision
		for (const cp of collisionPoints) {
			const threat = this.analyzeCollisionPointWithTrajectory(ourSnake, cp);
			if (threat) {
				threats.push(threat);
			}
		}

		// Sort by priority (most dangerous first)
		threats.sort((a, b) => b.priority - a.priority);
		this.state.threatAnalyses = threats;

		// Check if we need to take control
		const maxThreat = threats[0];
		const needsControl = maxThreat && 
			maxThreat.threatLevel > this.opt.maxThreatLevel &&
			(currentTime - this.lastControlTime) > this.opt.controlCooldown;

		if (needsControl) {
			this.takeControl(ourSnake, maxThreat);
			return true;
		} else if (this.state.emergencyAvoidanceActive) {
			// Continue emergency control for minimum duration
			const controlDuration = currentTime - this.lastControlTime;
			if (controlDuration < this.opt.minControlDuration) {
				this.continueControl(ourSnake, maxThreat);
				return true;
			} else {
				this.releaseControl();
			}
		}

		return false;
	}

	/**
	 * Takes control of the snake to avoid collision - ONE PRECISE CORRECTION
	 */
	private takeControl(ourSnake: ISlither, threat: ThreatAnalysis): void {
		this.state.emergencyAvoidanceActive = true;
		this.lastControlTime = window.timeObj ? window.timeObj.now() : Date.now();

		console.log(`🚨 GOD MODE TAKEOVER! Threat: ${(threat.threatLevel * 100).toFixed(0)}%, Time: ${threat.timeToCollision.toFixed(1)} frames`);

		// Apply ONE precise correction to avoidance angle
		this.setMouseDirection(threat.avoidanceAngle);

		// Boost speed if threat is very close
		if (threat.threatLevel > this.opt.speedBoostThreshold) {
			window.setAcceleration(1);
			console.log(`⚡ BOOST ACTIVATED`);
		}
	}

	/**
	 * Continues emergency control briefly to complete the maneuver
	 */
	private continueControl(ourSnake: ISlither, threat: ThreatAnalysis | undefined): void {
		// Only maintain the correction briefly - no re-calculation
		// This ensures smooth completion of the avoidance maneuver
	}

	/**
	 * Releases control back to the player
	 */
	private releaseControl(): void {
		this.state.emergencyAvoidanceActive = false;
		window.setAcceleration(0);
		console.log(`✅ GOD MODE RELEASED - Control returned to player`);
	}



	/**
	 * Sets mouse direction to control snake movement
	 */
	private setMouseDirection(angle: number): void {
		const distance = 100; // Distance from snake center
		const targetX = window.view_xx + Math.cos(angle) * distance;
		const targetY = window.view_yy + Math.sin(angle) * distance;
		
		// Set mouse coordinates
		window.xm = targetX - window.view_xx;
		window.ym = targetY - window.view_yy;
	}

	/**
	 * Draws visual debugging information
	 */
	public drawVisuals(ctx: CanvasRenderingContext2D, ourSnake: ISlither): void {
		if (!this.visualsEnabled || !ourSnake) return;

		// Always draw status indicator to show visuals are working
		ctx.fillStyle = this.state.enabled ? 'rgba(0, 255, 0, 0.8)' : 'rgba(255, 0, 0, 0.8)';
		ctx.font = '16px Arial';
		const status = this.state.enabled ? 'GOD MODE: ON' : 'GOD MODE: OFF';
		ctx.fillText(status, 10, 70);

		if (!this.state.enabled) return;

		// Use proper coordinate mapping like the bot does
		const mapToCanvas = (point: { x: number; y: number }) => ({
			x: window.mww2 + (point.x - window.view_xx) * window.gsc,
			y: window.mhh2 + (point.y - window.view_yy) * window.gsc,
		});

		const snakeScreen = mapToCanvas({ x: ourSnake.xx, y: ourSnake.yy });
		const scaledDangerRadius = this.opt.dangerRadius * window.gsc;
		const scaledEmergencyRadius = this.opt.emergencyRadius * window.gsc;

		// Draw danger radius (larger and more visible)
		ctx.beginPath();
		ctx.arc(snakeScreen.x, snakeScreen.y, scaledDangerRadius, 0, 2 * Math.PI);
		ctx.strokeStyle = this.state.emergencyAvoidanceActive ? 'rgba(255, 0, 0, 0.8)' : 'rgba(255, 255, 0, 0.6)';
		ctx.lineWidth = 3;
		ctx.stroke();

		// Draw emergency radius
		ctx.beginPath();
		ctx.arc(snakeScreen.x, snakeScreen.y, scaledEmergencyRadius, 0, 2 * Math.PI);
		ctx.strokeStyle = 'rgba(255, 0, 0, 0.9)';
		ctx.lineWidth = 2;
		ctx.stroke();

		// Draw collision prediction rays
		const rayLength = 150 * window.gsc;
		const ourAngle = ourSnake.ang;
		const endX = snakeScreen.x + Math.cos(ourAngle) * rayLength;
		const endY = snakeScreen.y + Math.sin(ourAngle) * rayLength;
		
		ctx.beginPath();
		ctx.moveTo(snakeScreen.x, snakeScreen.y);
		ctx.lineTo(endX, endY);
		ctx.strokeStyle = 'rgba(0, 255, 255, 0.7)';
		ctx.lineWidth = 2;
		ctx.stroke();

		// Draw threats
		for (const threat of this.state.threatAnalyses) {
			if (threat.threatLevel > 0.3) {
				// Draw threat level as colored circle
				const intensity = Math.min(threat.threatLevel, 1);
				const red = Math.floor(255 * intensity);
				const green = Math.floor(255 * (1 - intensity));
				
				ctx.fillStyle = `rgba(${red}, ${green}, 0, 0.6)`;
				ctx.beginPath();
				ctx.arc(ourSnake.xx - window.view_xx, ourSnake.yy - window.view_yy - 50, 10, 0, 2 * Math.PI);
				ctx.fill();

				// Draw avoidance direction
				if (this.state.emergencyAvoidanceActive) {
					const endX = (ourSnake.xx + Math.cos(threat.avoidanceAngle) * 80) - window.view_xx;
					const endY = (ourSnake.yy + Math.sin(threat.avoidanceAngle) * 80) - window.view_yy;
					
					ctx.beginPath();
					ctx.moveTo(ourSnake.xx - window.view_xx, ourSnake.yy - window.view_yy);
					ctx.lineTo(endX, endY);
					ctx.strokeStyle = 'rgba(0, 255, 0, 0.8)';
					ctx.lineWidth = 3;
					ctx.stroke();
				}
			}
		}

		// Draw detailed debug information
		ctx.fillStyle = this.state.emergencyAvoidanceActive ? 'rgba(255, 0, 0, 1)' : 'rgba(255, 255, 255, 0.9)';
		ctx.font = '14px Arial';
		
		// Show current state
		const stateText = this.state.emergencyAvoidanceActive ? 'EMERGENCY ACTIVE!' : 'Monitoring...';
		ctx.fillText(stateText, 10, 90);
		
		// Show nearby snakes count
		let nearbyCount = 0;
		if (window.slithers && ourSnake) {
			for (let i = 0; i < window.slithers.length; i++) {
				const snake = window.slithers[i];
				if (!snake || snake.id === ourSnake.id || snake.dead) continue;
				const distance = Math.sqrt(getDistance2(ourSnake.xx, ourSnake.yy, snake.xx, snake.yy));
				if (distance < this.opt.dangerRadius * 3) nearbyCount++;
			}
		}
		ctx.fillText(`Nearby Snakes: ${nearbyCount}`, 10, 110);
		
		// Show threat count and max threat level
		ctx.fillText(`Threats: ${this.state.threatAnalyses.length}`, 10, 130);
		if (this.state.threatAnalyses.length > 0) {
			const maxThreat = this.state.threatAnalyses[0];
			ctx.fillText(`Max Threat: ${(maxThreat.threatLevel * 100).toFixed(0)}%`, 10, 150);
			ctx.fillText(`Time to Collision: ${maxThreat.timeToCollision.toFixed(1)}f`, 10, 170);
		}

		// Debug: Show collision points found
		if (window.slithers && ourSnake) {
			const collisionPoints = this.getCollisionPointsLikeBoot(ourSnake);
			ctx.fillText(`Collision Points: ${collisionPoints.length}`, 10, 190);
			
			// Draw collision points
			for (const cp of collisionPoints.slice(0, 5)) { // Show first 5
				const cpScreen = mapToCanvas({ x: cp.x, y: cp.y });
				ctx.beginPath();
				ctx.arc(cpScreen.x, cpScreen.y, 5, 0, 2 * Math.PI);
				ctx.fillStyle = cp.type === 0 ? 'rgba(255, 0, 0, 0.8)' : 'rgba(255, 165, 0, 0.8)';
				ctx.fill();
			}
		}
	}

	public getStats() {
		return {
			enabled: this.state.enabled,
			visualsEnabled: this.visualsEnabled,
			threatCount: this.state.threatAnalyses.length,
			emergencyActive: this.state.emergencyAvoidanceActive,
			maxThreatLevel: this.state.threatAnalyses[0]?.threatLevel || 0,
		};
	}
}
