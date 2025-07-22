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

export class GodMode {
	private state: GodModeState = {
		enabled: false,
		collisionPredictionFrames: 30,
		emergencyAvoidanceActive: false,
		lastEmergencyTime: 0,
		threatAnalyses: [],
		killOpportunities: [],
	};

	public opt = {
		predictionFrames: 30,
		minThreatDistance: 100,
		emergencyCooldown: 60,
		maxThreatLevel: 0.8,
		trajectorySteps: 5,
		killOpportunityThreshold: 0.7,
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
		}
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

	private analyzeCollisionThreat(
		ourSnake: ISlither,
		targetSnake: ISlither,
		trajectory: TrajectoryPoint[],
	): ThreatAnalysis | null {
		const ourX = ourSnake.xx;
		const ourY = ourSnake.yy;
		const ourSpeed = ourSnake.sp;
		const ourAngle = ourSnake.ang;
		const dangerRadius = 50;

		let minDistance = Infinity;
		let collisionTime = Infinity;
		let threatLevel = 0;

		for (let frame = 0; frame < trajectory.length; frame++) {
			const targetPos = trajectory[frame];
			
			const ourCos = Math.cos(ourAngle);
			const ourSin = Math.sin(ourAngle);
			const ourPredictedX = ourX + ourSpeed * ourCos * frame;
			const ourPredictedY = ourY + ourSpeed * ourSin * frame;

			const distance = Math.sqrt(
				getDistance2(ourPredictedX, ourPredictedY, targetPos.x, targetPos.y),
			);

			if (distance < minDistance) {
				minDistance = distance;
				collisionTime = frame;
			}

			if (distance < dangerRadius && frame < this.opt.predictionFrames / 2) {
				threatLevel = Math.max(threatLevel, 1 - distance / dangerRadius);
			}
		}

		if (threatLevel > 0.1) {
			const targetPos = trajectory[Math.min(collisionTime, trajectory.length - 1)];
			const avoidanceAngle = fastAtan2(
				targetPos.y - ourY,
				targetPos.x - ourX,
			) + Math.PI / 2;

			return {
				snakeId: targetSnake.id,
				threatLevel,
				timeToCollision: collisionTime,
				avoidanceAngle,
				priority: threatLevel * (1 / (collisionTime + 1)),
			};
		}

		return null;
	}

	public analyzeThreats(ourSnake: ISlither): {
		threats: ThreatAnalysis[];
		opportunities: KillOpportunity[];
		emergencyAvoidance: boolean;
	} {
		if (!this.state.enabled || !ourSnake) {
			return {
				threats: [],
				opportunities: [],
				emergencyAvoidance: false,
			};
		}

		const threats: ThreatAnalysis[] = [];

		for (let i = 0; i < window.slithers.length; i++) {
			const snake = window.slithers[i];
			if (!snake || snake.id === ourSnake.id || snake.dead) {
				continue;
			}

			const distance = Math.sqrt(
				getDistance2(ourSnake.xx, ourSnake.yy, snake.xx, snake.yy),
			);
			if (distance > 500) {
				continue;
			}

			const trajectory = this.predictSnakeTrajectory(snake, this.opt.predictionFrames);
			const threat = this.analyzeCollisionThreat(ourSnake, snake, trajectory);
			if (threat) {
				threats.push(threat);
			}
		}

		threats.sort((a, b) => b.priority - a.priority);

		const maxThreat = threats[0];
		const emergencyAvoidance = maxThreat && 
			maxThreat.threatLevel > this.opt.maxThreatLevel &&
			maxThreat.timeToCollision < 10;

		this.state.threatAnalyses = threats;
		this.state.emergencyAvoidanceActive = emergencyAvoidance || false;

		return {
			threats,
			opportunities: [],
			emergencyAvoidance: emergencyAvoidance || false,
		};
	}

	public getEmergencyAvoidanceTarget(ourSnake: ISlither): Point | null {
		if (!this.state.emergencyAvoidanceActive || this.state.threatAnalyses.length === 0) {
			return null;
		}

		const primaryThreat = this.state.threatAnalyses[0];
		const avoidanceDistance = 200;

		const cos = Math.cos(primaryThreat.avoidanceAngle);
		const sin = Math.sin(primaryThreat.avoidanceAngle);

		return {
			x: ourSnake.xx + cos * avoidanceDistance,
			y: ourSnake.yy + sin * avoidanceDistance,
		};
	}

	public getStats() {
		return {
			enabled: this.state.enabled,
			threatCount: this.state.threatAnalyses.length,
			emergencyActive: this.state.emergencyAvoidanceActive,
			maxThreatLevel: this.state.threatAnalyses[0]?.threatLevel || 0,
		};
	}
}
