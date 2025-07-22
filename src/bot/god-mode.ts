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
		// Detection settings
		predictionFrames: 20,           // Frames to look ahead
		dangerRadius: 60,               // Minimum safe distance
		emergencyRadius: 35,            // Critical distance requiring immediate action
		
		// Response settings
		maxThreatLevel: 0.6,           // Lower threshold for faster response
		controlCooldown: 10,           // Frames between control takeovers
		minControlDuration: 5,         // Minimum frames to hold control
		
		// Precision settings
		angleAdjustmentPrecision: 0.1, // How precise angle corrections are
		speedBoostThreshold: 0.8,      // When to boost speed during escape
		tightSpaceThreshold: 80,       // Distance threshold for tight space detection
	};

	public isEnabled(): boolean {
		return this.state.enabled;
	}

	public setEnabled(enabled: boolean): void {
		this.state.enabled = enabled;
		if (!enabled) {
			this.state.emergencyAvoidanceActive = false;
			this.state.threatAnalyses = [];
			this.state.killOpportunities = [];
			this.releaseControl();
		}
	}

	public setVisualsEnabled(enabled: boolean): void {
		this.visualsEnabled = enabled;
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
	 * Analyzes collision threat with precision angle and distance calculations
	 */
	private analyzeCollisionThreat(
		ourSnake: ISlither,
		targetSnake: ISlither,
	): ThreatAnalysis | null {
		const ourX = ourSnake.xx;
		const ourY = ourSnake.yy;
		const ourAngle = ourSnake.ang;
		const ourSpeed = ourSnake.sp;

		// Check head collision
		const headDistance = Math.sqrt(getDistance2(ourX, ourY, targetSnake.xx, targetSnake.yy));
		const headThreat = this.calculateDirectThreat(ourSnake, targetSnake.xx, targetSnake.yy, headDistance);

		// Check body collisions
		let maxBodyThreat: ThreatAnalysis | null = null;
		if (targetSnake.pts) {
			for (const pt of targetSnake.pts) {
				if (pt && !pt.dying) {
					const bodyDistance = Math.sqrt(getDistance2(ourX, ourY, pt.xx, pt.yy));
					if (bodyDistance < this.opt.dangerRadius * 2) {
						const bodyThreat = this.calculateDirectThreat(ourSnake, pt.xx, pt.yy, bodyDistance);
						if (bodyThreat && (!maxBodyThreat || bodyThreat.threatLevel > maxBodyThreat.threatLevel)) {
							maxBodyThreat = bodyThreat;
						}
					}
				}
			}
		}

		// Return the most dangerous threat
		if (headThreat && maxBodyThreat) {
			return headThreat.threatLevel > maxBodyThreat.threatLevel ? headThreat : maxBodyThreat;
		}
		return headThreat || maxBodyThreat;
	}

	/**
	 * Calculates direct threat level and optimal avoidance angle
	 */
	private calculateDirectThreat(ourSnake: ISlither, targetX: number, targetY: number, distance: number): ThreatAnalysis | null {
		if (distance > this.opt.dangerRadius) return null;

		const ourX = ourSnake.xx;
		const ourY = ourSnake.yy;
		const ourAngle = ourSnake.ang;

		// Calculate angle to target
		const angleToTarget = fastAtan2(targetY - ourY, targetX - ourX);
		const relativeAngle = Math.abs(angleToTarget - ourAngle);
		const normalizedAngle = Math.min(relativeAngle, 2 * Math.PI - relativeAngle);

		// Only consider targets in front of us (within 120 degrees)
		if (normalizedAngle > Math.PI * 2/3) return null;

		// Calculate threat level based on distance and angle
		const distanceThreat = Math.max(0, 1 - distance / this.opt.dangerRadius);
		const angleThreat = Math.max(0, 1 - normalizedAngle / (Math.PI / 2));
		const threatLevel = distanceThreat * 0.7 + angleThreat * 0.3;

		if (threatLevel < 0.1) return null;

		// Calculate precise avoidance angle
		let avoidanceAngle: number;
		
		if (distance < this.opt.emergencyRadius) {
			// Emergency: sharp turn away
			const escapeAngle = angleToTarget + (Math.random() > 0.5 ? Math.PI/2 : -Math.PI/2);
			avoidanceAngle = escapeAngle;
		} else {
			// Gradual avoidance: minimal angle adjustment
			const adjustmentMagnitude = this.opt.angleAdjustmentPrecision * threatLevel;
			const turnDirection = this.determineTurnDirection(ourSnake, targetX, targetY);
			avoidanceAngle = ourAngle + turnDirection * adjustmentMagnitude;
		}

		return {
			snakeId: -1, // Not tracking specific snake IDs for direct threats
			threatLevel,
			timeToCollision: Math.max(1, distance / Math.max(ourSnake.sp, 1)),
			avoidanceAngle,
			priority: threatLevel * (this.opt.emergencyRadius / Math.max(distance, 1)),
		};
	}

	/**
	 * Determines optimal turn direction to avoid obstacle
	 */
	private determineTurnDirection(ourSnake: ISlither, targetX: number, targetY: number): number {
		const ourX = ourSnake.xx;
		const ourY = ourSnake.yy;
		const ourAngle = ourSnake.ang;

		// Vector from us to target
		const toTarget = { x: targetX - ourX, y: targetY - ourY };
		
		// Our current direction vector
		const ourDirection = { x: Math.cos(ourAngle), y: Math.sin(ourAngle) };

		// Cross product determines which side the target is on
		const crossProduct = ourDirection.x * toTarget.y - ourDirection.y * toTarget.x;
		
		// Turn away from the target
		return crossProduct > 0 ? -1 : 1;
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
	 * Takes control of the snake to avoid collision
	 */
	private takeControl(ourSnake: ISlither, threat: ThreatAnalysis): void {
		this.state.emergencyAvoidanceActive = true;
		this.lastControlTime = window.timeObj ? window.timeObj.now() : Date.now();

		// Calculate safe direction
		const safeAngle = this.calculateSafeAngle(ourSnake, threat);
		this.setMouseDirection(safeAngle);

		// Boost speed if threat is very close
		if (threat.threatLevel > this.opt.speedBoostThreshold) {
			window.setAcceleration(1);
		}
	}

	/**
	 * Continues emergency control
	 */
	private continueControl(ourSnake: ISlither, threat: ThreatAnalysis | undefined): void {
		if (threat) {
			const safeAngle = this.calculateSafeAngle(ourSnake, threat);
			this.setMouseDirection(safeAngle);
		}
	}

	/**
	 * Releases control back to the player
	 */
	private releaseControl(): void {
		this.state.emergencyAvoidanceActive = false;
		window.setAcceleration(0);
	}

	/**
	 * Calculates the safest direction to move
	 */
	private calculateSafeAngle(ourSnake: ISlither, threat: ThreatAnalysis): number {
		// Start with the threat's suggested avoidance angle
		let safeAngle = threat.avoidanceAngle;

		// Check if this angle leads to other threats
		const testDistance = this.opt.dangerRadius;
		const testX = ourSnake.xx + Math.cos(safeAngle) * testDistance;
		const testY = ourSnake.yy + Math.sin(safeAngle) * testDistance;

		// Look for secondary threats in that direction
		let hasSecondaryThreat = false;
		for (const otherThreat of this.state.threatAnalyses) {
			if (otherThreat === threat) continue;
			
			const threatDistance = Math.sqrt(
				getDistance2(testX, testY, ourSnake.xx, ourSnake.yy)
			);
			if (threatDistance < this.opt.dangerRadius) {
				hasSecondaryThreat = true;
				break;
			}
		}

		// If safe angle leads to another threat, try perpendicular directions
		if (hasSecondaryThreat) {
			const perpAngle1 = safeAngle + Math.PI / 2;
			const perpAngle2 = safeAngle - Math.PI / 2;
			
			// Choose the direction with more open space
			const space1 = this.calculateOpenSpace(ourSnake, perpAngle1);
			const space2 = this.calculateOpenSpace(ourSnake, perpAngle2);
			
			safeAngle = space1 > space2 ? perpAngle1 : perpAngle2;
		}

		return safeAngle;
	}

	/**
	 * Calculates available open space in a direction
	 */
	private calculateOpenSpace(ourSnake: ISlither, angle: number): number {
		const stepSize = 20;
		const maxSteps = 5;
		
		for (let step = 1; step <= maxSteps; step++) {
			const testX = ourSnake.xx + Math.cos(angle) * stepSize * step;
			const testY = ourSnake.yy + Math.sin(angle) * stepSize * step;
			
			// Check for collisions at this distance
			for (let i = 0; i < window.slithers.length; i++) {
				const snake = window.slithers[i];
				if (!snake || snake.id === ourSnake.id || snake.dead) continue;
				
				const headDist = Math.sqrt(getDistance2(testX, testY, snake.xx, snake.yy));
				if (headDist < 30) return step * stepSize;
				
				if (snake.pts) {
					for (const pt of snake.pts) {
						if (pt && !pt.dying) {
							const bodyDist = Math.sqrt(getDistance2(testX, testY, pt.xx, pt.yy));
							if (bodyDist < 25) return step * stepSize;
						}
					}
				}
			}
		}
		
		return maxSteps * stepSize;
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

		// Draw danger radius
		ctx.beginPath();
		ctx.arc(ourSnake.xx - window.view_xx, ourSnake.yy - window.view_yy, this.opt.dangerRadius, 0, 2 * Math.PI);
		ctx.strokeStyle = this.state.emergencyAvoidanceActive ? 'rgba(255, 0, 0, 0.5)' : 'rgba(255, 255, 0, 0.3)';
		ctx.lineWidth = 2;
		ctx.stroke();

		// Draw emergency radius
		ctx.beginPath();
		ctx.arc(ourSnake.xx - window.view_xx, ourSnake.yy - window.view_yy, this.opt.emergencyRadius, 0, 2 * Math.PI);
		ctx.strokeStyle = 'rgba(255, 0, 0, 0.7)';
		ctx.lineWidth = 1;
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

		// Draw status text
		ctx.fillStyle = this.state.emergencyAvoidanceActive ? 'rgba(255, 0, 0, 1)' : 'rgba(255, 255, 255, 0.8)';
		ctx.font = '14px Arial';
		const status = this.state.emergencyAvoidanceActive ? 'GOD MODE ACTIVE' : 'God Mode Ready';
		ctx.fillText(status, 10, 30);
		
		if (this.state.threatAnalyses.length > 0) {
			const maxThreat = this.state.threatAnalyses[0];
			ctx.fillText(`Threat Level: ${(maxThreat.threatLevel * 100).toFixed(0)}%`, 10, 50);
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
