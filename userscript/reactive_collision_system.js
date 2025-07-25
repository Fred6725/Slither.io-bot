/*
Perfect Reactive Collision Avoidance System
Based on bot.v2 (reactive) + bot.v3 (turn radius) - prediction complexity
Focuses on real-time protection and worst-case scenarios
*/

class ReactiveCollisionAvoidance {
  constructor(visualizer) {
    this.visualizer = visualizer;
    this.enabled = false;
    this.visualsEnabled = false;
    
    // Core reactive parameters
    this.baseLookaheadDistance = 180;
    this.baseDangerZoneRadius = 100;
    this.baseSafetyMargin = 50;
    this.boostSpeedThreshold = 6.5;
    
    // Turn radius constants (from v3 - accurate physics)
    this.turnRadiusBase = 50;
    this.lengthMultiplier = 0.05;
    this.speedMultiplier = 1.2;
    this.boostTurnPenalty = 2.0;  // Conservative for worst-case
    this.massMultiplier = 0.3;
    
    // Control system
    this.controlActive = false;
    this.lastControlAngle = 0;
    this.emergencyOverride = false;
    
    // Danger detection
    this.dangerZones = [];
    this.userIntentDirection = 0;  // Track where user wants to go
    this.lastUserInput = Date.now();
  }

  // Main update function - reactive defense only
  update(snake, snakes, borderSize) {
    if (!this.enabled || !snake) return null;

    this.dangerZones = [];
    const headPos = { x: snake.xx, y: snake.yy };
    const headAngle = snake.ang;
    const snakeRadius = this.getSnakeWidth(snake.sc) / 2;

    // Track user intent from mouse position
    this.updateUserIntent(headPos, headAngle);

    // Adjust parameters for current snake state
    this.adjustDynamicParameters(snake);

    // Detect immediate dangers (no prediction - just current state + worst case)
    this.detectImmediateDangers(headPos, headAngle, snakeRadius, snake.sp, snakes, borderSize);

    // Check if user's intended move will kill them
    const userMoveIsDangerous = this.wouldUserMoveCauseCollision(headPos, headAngle, snakeRadius);

    // Check if we need emergency correction
    const needsEmergencyCorrection = this.needsEmergencyCorrection(headPos, headAngle, snakeRadius);

    // Decision logic
    if (needsEmergencyCorrection) {
      // Case 1: Immediate death - take full control
      return this.executeEmergencyCorrection(headPos, headAngle, snakeRadius);
    } else if (userMoveIsDangerous) {
      // Case 2: User is steering into danger - prevent the move
      return this.preventDangerousMove(headPos, headAngle, snakeRadius);
    } else {
      // Case 3: All clear - let user control
      this.controlActive = false;
      return null;
    }
  }

  // Track where the user wants to go based on mouse position
  updateUserIntent(headPos, headAngle) {
    // Calculate intended direction from mouse position
    if (window.xm !== undefined && window.ym !== undefined) {
      const mouseWorldX = window.view_xx + window.xm;
      const mouseWorldY = window.view_yy + window.ym;
      
      this.userIntentDirection = Math.atan2(
        mouseWorldY - headPos.y,
        mouseWorldX - headPos.x
      );
      this.lastUserInput = Date.now();
    }
  }

  // Check if user's intended move would cause collision
  wouldUserMoveCauseCollision(headPos, headAngle, snakeRadius) {
    if (Date.now() - this.lastUserInput > 500) return false; // No recent input
    
    // Calculate where user wants to go
    const intentDistance = 100; // Check 100 pixels ahead
    const intendedPos = {
      x: headPos.x + Math.cos(this.userIntentDirection) * intentDistance,
      y: headPos.y + Math.sin(this.userIntentDirection) * intentDistance
    };

    // Check if intended path crosses any danger zones
    for (const danger of this.dangerZones) {
      const distanceToIntended = Math.sqrt(
        (intendedPos.x - danger.point.x) ** 2 + 
        (intendedPos.y - danger.point.y) ** 2
      );
      
      if (distanceToIntended < danger.radius) {
        console.log(`🚫 USER MOVE BLOCKED: Would hit ${danger.type} at ${distanceToIntended.toFixed(0)}px`);
        return true;
      }
    }

    return false;
  }

  // Check if we need emergency correction (imminent death)
  needsEmergencyCorrection(headPos, headAngle, snakeRadius) {
    // Find the closest danger
    if (this.dangerZones.length === 0) return false;

    const criticalDanger = this.dangerZones.find(d => 
      d.distance < snakeRadius + 60  // Very close to collision
    );

    if (criticalDanger) {
      console.log(`🚨 EMERGENCY: ${criticalDanger.type} at ${criticalDanger.distance.toFixed(0)}px`);
      return true;
    }

    return false;
  }

  // Execute emergency correction - full control
  executeEmergencyCorrection(headPos, headAngle, snakeRadius) {
    this.controlActive = true;
    this.emergencyOverride = true;

    // Find the closest danger
    const closestDanger = this.dangerZones.reduce((closest, current) => 
      current.distance < closest.distance ? current : closest
    );

    // Calculate emergency escape direction
    const obstacleAngle = Math.atan2(
      closestDanger.point.y - headPos.y,
      closestDanger.point.x - headPos.x
    );

    // Choose escape direction (perpendicular to obstacle direction)
    const escapeLeft = obstacleAngle + Math.PI / 2;
    const escapeRight = obstacleAngle - Math.PI / 2;

    // Pick the escape that requires less turning
    const leftTurn = Math.abs(this.angleDifference(escapeLeft, headAngle));
    const rightTurn = Math.abs(this.angleDifference(escapeRight, headAngle));

    const emergencyDirection = leftTurn < rightTurn ? escapeLeft : escapeRight;

    console.log(`⚡ EMERGENCY ESCAPE: ${(emergencyDirection * 180 / Math.PI).toFixed(1)}°`);
    return emergencyDirection;
  }

  // Prevent dangerous move - minimal correction
  preventDangerousMove(headPos, headAngle, snakeRadius) {
    this.controlActive = true;
    this.emergencyOverride = false;

    // Find safe direction closest to user intent
    const safeDirection = this.findSafeDirectionNearIntent(headPos, headAngle, snakeRadius);
    
    if (safeDirection !== null) {
      console.log(`🛡️ MOVE CORRECTED: From user intent to ${(safeDirection * 180 / Math.PI).toFixed(1)}°`);
      return safeDirection;
    }

    // If no safe direction found, use emergency escape
    return this.executeEmergencyCorrection(headPos, headAngle, snakeRadius);
  }

  // Find safe direction close to user's intended direction
  findSafeDirectionNearIntent(headPos, headAngle, snakeRadius) {
    const searchAngles = [];
    const searchRange = Math.PI / 3; // 60 degrees each side
    const steps = 12; // Check every 10 degrees

    // Generate angles around user intent
    for (let i = -steps; i <= steps; i++) {
      const angle = this.userIntentDirection + (i / steps) * searchRange;
      searchAngles.push(angle);
    }

    // Sort by how close they are to user intent
    searchAngles.sort((a, b) => 
      Math.abs(this.angleDifference(a, this.userIntentDirection)) - 
      Math.abs(this.angleDifference(b, this.userIntentDirection))
    );

    // Test each angle for safety
    for (const testAngle of searchAngles) {
      if (this.isDirectionSafe(headPos, testAngle, snakeRadius)) {
        return testAngle;
      }
    }

    return null; // No safe direction found
  }

  // Test if a direction is safe to travel
  isDirectionSafe(headPos, direction, snakeRadius, testDistance = 150) {
    const testPos = {
      x: headPos.x + Math.cos(direction) * testDistance,
      y: headPos.y + Math.sin(direction) * testDistance
    };

    // Check against all danger zones
    for (const danger of this.dangerZones) {
      const distanceToDanger = Math.sqrt(
        (testPos.x - danger.point.x) ** 2 + 
        (testPos.y - danger.point.y) ** 2
      );
      
      if (distanceToDanger < danger.radius + 20) { // Extra 20px safety margin
        return false;
      }
    }

    return true;
  }

  // Detect immediate dangers using worst-case scenarios
  detectImmediateDangers(headPos, headAngle, snakeRadius, snakeSpeed, snakes, borderSize) {
    // Check other snakes
    for (const snake of snakes) {
      if (!snake || snake.id === window.slither.id) continue;
      this.checkSnakeCollision(headPos, snakeRadius, snakeSpeed, snake);
    }

    // Check borders
    this.checkBorderCollision(headPos, snakeRadius, borderSize);
  }

  // Check collision with a snake using worst-case turn radius
  checkSnakeCollision(headPos, snakeRadius, mySpeed, targetSnake) {
    const targetRadius = this.getSnakeWidth(targetSnake.sc) / 2;
    const targetSpeed = targetSnake.sp || 5.78;
    
    // Calculate worst-case safety distance
    const myTurnRadius = this.calculateWorstCaseTurnRadius(window.slither);
    const enemyTurnRadius = this.calculateWorstCaseTurnRadius(targetSnake);
    
    // Worst-case scenario: both snakes could turn toward each other
    const worstCaseSafetyDistance = snakeRadius + targetRadius + 
      Math.max(myTurnRadius, enemyTurnRadius) * 0.3 + // Turn radius factor
      (mySpeed + targetSpeed) * 15; // Speed factor

    // Check head collision
    const headDistance = Math.sqrt(
      (headPos.x - targetSnake.xx) ** 2 + 
      (headPos.y - targetSnake.yy) ** 2
    );

    if (headDistance < worstCaseSafetyDistance) {
      this.dangerZones.push({
        point: { x: targetSnake.xx, y: targetSnake.yy },
        distance: headDistance,
        radius: worstCaseSafetyDistance,
        type: 'snake_head',
        snakeId: targetSnake.id,
        isBoosting: targetSpeed > this.boostSpeedThreshold
      });
    }

    // Check body collision
    if (targetSnake.pts) {
      for (let i = 0; i < targetSnake.pts.length; i++) {
        const bodyPart = targetSnake.pts[i];
        if (!bodyPart || bodyPart.dying) continue;

        const bodyDistance = Math.sqrt(
          (headPos.x - bodyPart.xx) ** 2 + 
          (headPos.y - bodyPart.yy) ** 2
        );

        const bodySafetyDistance = snakeRadius + targetRadius + myTurnRadius * 0.2;

        if (bodyDistance < bodySafetyDistance) {
          this.dangerZones.push({
            point: { x: bodyPart.xx, y: bodyPart.yy },
            distance: bodyDistance,
            radius: bodySafetyDistance,
            type: 'snake_body',
            bodyIndex: i
          });
        }
      }
    }
  }

  // Calculate worst-case turn radius (maximum possible)
  calculateWorstCaseTurnRadius(snake) {
    if (!snake) return this.turnRadiusBase;

    const length = this.getSnakeLength(snake);
    const speed = snake.sp || 5.78;
    const mass = snake.sc || 1.0;

    // Assume worst case: high speed + boost
    const worstCaseSpeed = Math.max(speed, 12.0); // Max possible speed
    const isBoosting = true; // Assume boosting for worst case

    let turnRadius = this.turnRadiusBase;

    // Length factor
    const lengthFactor = 1 + (length / 1000) * this.lengthMultiplier;
    turnRadius *= lengthFactor;

    // Speed factor (worst case)
    const speedFactor = 1 + ((worstCaseSpeed - 5.78) / 5.78) * this.speedMultiplier;
    turnRadius *= speedFactor;

    // Boost penalty (assume boosting)
    turnRadius *= this.boostTurnPenalty;

    // Mass factor
    const massFactor = 1 + (mass - 1) * this.massMultiplier;
    turnRadius *= massFactor;

    return Math.max(50, turnRadius);
  }

  // Check border collision
  checkBorderCollision(headPos, snakeRadius, borderSize) {
    if (!window.grd) return;

    const safeDistance = snakeRadius + this.safetyMargin;
    const distanceToCenter = Math.sqrt(
      (headPos.x - window.grd) ** 2 + 
      (headPos.y - window.grd) ** 2
    );

    if (distanceToCenter > window.grd - safeDistance) {
      const borderAngle = Math.atan2(window.grd - headPos.y, window.grd - headPos.x);
      const borderPoint = {
        x: window.grd + Math.cos(borderAngle) * window.grd,
        y: window.grd + Math.sin(borderAngle) * window.grd
      };

      const borderDistance = Math.sqrt(
        (headPos.x - borderPoint.x) ** 2 + 
        (headPos.y - borderPoint.y) ** 2
      );

      this.dangerZones.push({
        point: borderPoint,
        distance: borderDistance,
        radius: safeDistance,
        type: 'border'
      });
    }
  }

  // Adjust parameters based on snake state
  adjustDynamicParameters(snake) {
    const speedMultiplier = snake.sp / 5.78;
    const isBoosting = snake.sp > this.boostSpeedThreshold;
    const sizeMultiplier = Math.max(0.5, snake.sc / 10);

    if (isBoosting) {
      this.lookaheadDistance = this.baseLookaheadDistance * 3.0;
      this.dangerZoneRadius = this.baseDangerZoneRadius * 2.5;
      this.safetyMargin = this.baseSafetyMargin * speedMultiplier * sizeMultiplier * 2.0;
    } else {
      this.lookaheadDistance = this.baseLookaheadDistance * speedMultiplier;
      this.dangerZoneRadius = this.baseDangerZoneRadius * 1.5;
      this.safetyMargin = this.baseSafetyMargin * speedMultiplier * sizeMultiplier;
    }
  }

  // Helper methods
  getSnakeWidth(sc) {
    return Math.round(sc * 29);
  }

  getSnakeLength(snake) {
    if (!snake || snake.sct < 0 || snake.fam < 0 || snake.rsc < 0) {
      return 0;
    }
    const sct = snake.sct + snake.rsc;
    return Math.trunc(15 * (window.fpsls[sct] + snake.fam / window.fmlts[sct] - 1) - 5);
  }

  angleDifference(angle1, angle2) {
    let diff = angle1 - angle2;
    while (diff > Math.PI) diff -= 2 * Math.PI;
    while (diff < -Math.PI) diff += 2 * Math.PI;
    return diff;
  }

  // Debug visualization
  drawDebugVisuals(headPos, headAngle, snakeRadius) {
    if (!this.visualsEnabled) return;

    // Draw user intent direction
    if (Date.now() - this.lastUserInput < 1000) {
      const intentPoint = {
        x: headPos.x + Math.cos(this.userIntentDirection) * 120,
        y: headPos.y + Math.sin(this.userIntentDirection) * 120
      };
      this.visualizer.drawLine(headPos, intentPoint, "yellow", 3);
    }

    // Draw danger zones
    for (const danger of this.dangerZones) {
      let color;
      switch (danger.type) {
        case 'snake_head': color = "red"; break;
        case 'snake_body': color = "orange"; break;
        case 'border': color = "purple"; break;
        default: color = "white";
      }

      this.visualizer.drawCircle(
        { x: danger.point.x, y: danger.point.y, r: danger.radius },
        color, false, 0.6
      );
    }

    // Draw control status
    if (this.controlActive) {
      const statusColor = this.emergencyOverride ? "red" : "yellow";
      const statusText = this.emergencyOverride ? "EMERGENCY" : "PROTECTING";
      
      this.visualizer.drawCircle(
        { x: headPos.x, y: headPos.y - 60, r: 15 },
        statusColor, true, 0.8
      );
      
      console.log(`🛡️ REACTIVE DEFENSE: ${statusText}`);
    }
  }

  toggle() {
    this.enabled = !this.enabled;
    console.log(`🛡️ Reactive Collision Avoidance: ${this.enabled ? 'ENABLED' : 'DISABLED'}`);
  }

  toggleVisuals() {
    this.visualsEnabled = !this.visualsEnabled;
    console.log(`👁️ Reactive Debug Visuals: ${this.visualsEnabled ? 'ENABLED' : 'DISABLED'}`);
  }
}

// Export for integration
if (typeof module !== 'undefined' && module.exports) {
  module.exports = ReactiveCollisionAvoidance;
}