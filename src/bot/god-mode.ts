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
	 * Analyzes collision threat using proper trajectory physics
	 */
	private analyzeCollisionThreat(
		ourSnake: ISlither,
		targetSnake: ISlither,
	): ThreatAnalysis | null {
		const ourX = ourSnake.xx;
		const ourY = ourSnake.yy;
		const ourAngle = ourSnake.ang;
		const ourSpeed = ourSnake.sp;

		let closestCollision: {
			point: Point;
			timeToCollision: number;
			threatLevel: number;
			collisionAngle: number;
		} | null = null;

		// Check collision with target snake head
		const headCollision = this.calculateTrajectoryCollision(
			ourSnake, 
			{ x: targetSnake.xx, y: targetSnake.yy, speed: targetSnake.sp, angle: targetSnake.ang },
			25 // Head radius
		);
		if (headCollision) {
			closestCollision = headCollision;
		}

		// Check collision with each body segment
		if (targetSnake.pts) {
			for (const pt of targetSnake.pts) {
				if (pt && !pt.dying) {
					const bodyCollision = this.calculateTrajectoryCollision(
						ourSnake,
						{ x: pt.xx, y: pt.yy, speed: 0, angle: 0 }, // Body segments are stationary
						15 // Body radius
					);
					
					if (bodyCollision && (!closestCollision || bodyCollision.timeToCollision < closestCollision.timeToCollision)) {
						closestCollision = bodyCollision;
					}
				}
			}
		}

		if (!closestCollision) return null;

		// Calculate avoidance angle based on collision angle and urgency
		const avoidanceAngle = this.calculateAvoidanceAngle(
			ourSnake, 
			closestCollision.point, 
			closestCollision.collisionAngle,
			closestCollision.threatLevel
		);

		return {
			snakeId: targetSnake.id,
			threatLevel: closestCollision.threatLevel,
			timeToCollision: closestCollision.timeToCollision,
			avoidanceAngle,
			priority: closestCollision.threatLevel * (1 / Math.max(closestCollision.timeToCollision, 1)),
		};
	}

	/**
	 * Calculates trajectory-based collision using proper physics
	 */
	private calculateTrajectoryCollision(
		ourSnake: ISlither,
		target: { x: number; y: number; speed: number; angle: number },
		targetRadius: number
	): { point: Point; timeToCollision: number; threatLevel: number; collisionAngle: number } | null {
		
		const ourX = ourSnake.xx;
		const ourY = ourSnake.yy;
		const ourAngle = ourSnake.ang;
		const ourSpeed = ourSnake.sp;
		
		// Calculate our velocity components
		const ourVx = ourSpeed * Math.cos(ourAngle);
		const ourVy = ourSpeed * Math.sin(ourAngle);
		
		// Calculate target velocity components
		const targetVx = target.speed * Math.cos(target.angle);
		const targetVy = target.speed * Math.sin(target.angle);
		
		// Relative position and velocity
		const dx = target.x - ourX;
		const dy = target.y - ourY;
		const dvx = targetVx - ourVx;
		const dvy = targetVy - ourVy;
		
		// Collision radius (our radius + target radius + safety margin)
		const collisionRadius = 15 + targetRadius + 10; // 10px safety margin
		
		// Quadratic equation coefficients for collision detection
		// |position(t)|² = collisionRadius²
		const a = dvx * dvx + dvy * dvy;
		const b = 2 * (dx * dvx + dy * dvy);
		const c = dx * dx + dy * dy - collisionRadius * collisionRadius;
		
		// No relative motion - check if already colliding
		if (Math.abs(a) < 0.001) {
			const currentDistance = Math.sqrt(dx * dx + dy * dy);
			if (currentDistance <= collisionRadius) {
				return {
					point: { x: target.x, y: target.y },
					timeToCollision: 0,
					threatLevel: 1.0,
					collisionAngle: Math.atan2(dy, dx)
				};
			}
			return null;
		}
		
		// Solve quadratic equation
		const discriminant = b * b - 4 * a * c;
		if (discriminant < 0) return null; // No collision
		
		const sqrtDiscriminant = Math.sqrt(discriminant);
		const t1 = (-b - sqrtDiscriminant) / (2 * a);
		const t2 = (-b + sqrtDiscriminant) / (2 * a);
		
		// We want the first collision time (smallest positive t)
		let collisionTime = -1;
		if (t1 > 0 && t2 > 0) {
			collisionTime = Math.min(t1, t2);
		} else if (t1 > 0) {
			collisionTime = t1;
		} else if (t2 > 0) {
			collisionTime = t2;
		} else {
			return null; // Collision in the past
		}
		
		// Don't care about very distant collisions
		const maxLookaheadFrames = 120; // 2 seconds at 60fps
		if (collisionTime > maxLookaheadFrames) return null;
		
		// Calculate collision point
		const collisionX = ourX + ourVx * collisionTime;
		const collisionY = ourY + ourVy * collisionTime;
		
		// Calculate angle of collision (for avoidance calculation)
		const collisionAngle = Math.atan2(collisionY - ourY, collisionX - ourX);
		
		// Calculate threat level based on time to collision and approach angle
		const threatLevel = Math.max(0, Math.min(1, 1 - collisionTime / 60)); // 1.0 at time=0, 0.0 at time=60
		
		// Check if we're actually heading toward the collision
		const angleToCollision = Math.atan2(collisionY - ourY, collisionX - ourX);
		const angleDifference = Math.abs(ourAngle - angleToCollision);
		const normalizedAngleDiff = Math.min(angleDifference, 2 * Math.PI - angleDifference);
		
		// Only consider collisions if we're heading somewhat toward them
		if (normalizedAngleDiff > Math.PI / 2) return null;
		
		return {
			point: { x: collisionX, y: collisionY },
			timeToCollision: collisionTime,
			threatLevel,
			collisionAngle
		};
	}

	/**
	 * Calculates optimal avoidance angle based on collision physics and approach angle
	 */
	private calculateAvoidanceAngle(
		ourSnake: ISlither, 
		collisionPoint: Point, 
		collisionAngle: number, 
		threatLevel: number
	): number {
		const ourAngle = ourSnake.ang;
		const ourSpeed = ourSnake.sp;
		
		// Calculate approach angle relative to collision
		const approachAngle = Math.abs(ourAngle - collisionAngle);
		const normalizedApproach = Math.min(approachAngle, 2 * Math.PI - approachAngle);
		
		// Determine if we're boosting (affects turning radius)
		const isBoosting = ourSpeed > 6; // Base speed is usually ~5.78
		const turningMultiplier = isBoosting ? 0.7 : 1.0; // Harder to turn when boosting
		
		// Calculate correction magnitude based on approach angle
		let correctionAngle: number;
		
		if (normalizedApproach > Math.PI * 0.7) {
			// Nearly head-on (90° approach) - sharp turn required
			correctionAngle = Math.PI * 0.4 * turningMultiplier; // 72° turn (less when boosting)
		} else if (normalizedApproach > Math.PI * 0.3) {
			// Medium angle approach - moderate correction
			correctionAngle = Math.PI * 0.25 * turningMultiplier; // 45° turn
		} else {
			// Shallow angle approach - gentle correction
			correctionAngle = Math.PI * 0.1 * turningMultiplier; // 18° turn
		}
		
		// Increase correction based on threat urgency
		correctionAngle *= (0.5 + threatLevel * 0.5); // Scale from 50% to 100% based on urgency
		
		// Determine turn direction (away from collision point)
		const turnDirection = this.determineBestTurnDirection(
			ourSnake, 
			collisionPoint, 
			correctionAngle
		);
		
		// Calculate final avoidance angle
		const avoidanceAngle = ourAngle + turnDirection * correctionAngle;
		
		// Normalize angle
		return ((avoidanceAngle % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
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
	 */
	public checkAndAssist(ourSnake: ISlither): boolean {
		if (!this.state.enabled || !ourSnake || !window.playing) {
			return false;
		}

		const threats: ThreatAnalysis[] = [];
		const currentTime = window.timeObj ? window.timeObj.now() : Date.now();

		// Analyze nearby threats
		for (let i = 0; i < window.slithers.length; i++) {
			const snake = window.slithers[i];
			if (!snake || snake.id === ourSnake.id || snake.dead) {
				continue;
			}

			// Only check nearby snakes for performance
			const distance = Math.sqrt(
				getDistance2(ourSnake.xx, ourSnake.yy, snake.xx, snake.yy),
			);
			if (distance > this.opt.dangerRadius * 3) {
				continue;
			}

			const threat = this.analyzeCollisionThreat(ourSnake, snake);
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

		// Calculate screen position of our snake
		const screenX = ourSnake.xx - window.view_xx;
		const screenY = ourSnake.yy - window.view_yy;

		// Draw danger radius (larger and more visible)
		ctx.beginPath();
		ctx.arc(screenX, screenY, this.opt.dangerRadius, 0, 2 * Math.PI);
		ctx.strokeStyle = this.state.emergencyAvoidanceActive ? 'rgba(255, 0, 0, 0.8)' : 'rgba(255, 255, 0, 0.6)';
		ctx.lineWidth = 3;
		ctx.stroke();

		// Draw emergency radius
		ctx.beginPath();
		ctx.arc(screenX, screenY, this.opt.emergencyRadius, 0, 2 * Math.PI);
		ctx.strokeStyle = 'rgba(255, 0, 0, 0.9)';
		ctx.lineWidth = 2;
		ctx.stroke();

		// Draw collision prediction rays
		const rayLength = 150;
		const ourAngle = ourSnake.ang;
		const endX = screenX + Math.cos(ourAngle) * rayLength;
		const endY = screenY + Math.sin(ourAngle) * rayLength;
		
		ctx.beginPath();
		ctx.moveTo(screenX, screenY);
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
