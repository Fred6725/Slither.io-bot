/*
The MIT License (MIT)
 Reactive Collision Avoidance - Worst Case Scenario Based
*/
// ==UserScript==
// @name         Reactive Slither.io Bot - Worst Case Scenarios
// @namespace    https://github.com/reactive-slither-bot
// @version      1.0.0
// @description  Reactive collision avoidance based on worst-case scenarios and trajectory math
// @author       Reactive Bot Team
// @match        http://slither.io
// @match        http://slither.com/io*
// @grant        none
// ==/UserScript==

"use strict";

(() => {
  // ==========================================
  // UTILITIES 
  // ==========================================
  
  const fastAtan2 = (y, x) => Math.atan2(y, x);
  const getDistance = (x1, y1, x2, y2) => Math.sqrt((x1-x2)**2 + (y1-y2)**2);
  const angleDiff = (a1, a2) => {
    let diff = a1 - a2;
    while (diff > Math.PI) diff -= 2 * Math.PI;
    while (diff < -Math.PI) diff += 2 * Math.PI;
    return diff;
  };

  // ==========================================
  // REACTIVE COLLISION AVOIDANCE SYSTEM
  // ==========================================
  
  class ReactiveCollisionAvoidance {
    constructor() {
      this.enabled = false;
      
      // Worst-case scenario parameters
      this.maxBoostSpeed = 13.5; // Absolute maximum boost speed
      this.maxTurnRate = 0.05;   // Maximum turn rate per frame (radians)
      this.reactionTime = 3;     // Frames to react (human + system delay)
      
      // Trajectory correction parameters  
      this.minCorrectionAngle = Math.PI / 32; // Minimum correction (5.6°)
      this.maxCorrectionAngle = Math.PI / 4;  // Maximum correction (45°)
      
      // Control state
      this.takingControl = false;
      this.correctionAngle = 0;
      this.lastSafeAngle = 0;
    }

    // ==========================================
    // WORST-CASE TRAJECTORY ANALYSIS
    // ==========================================
    
    // Check if our current trajectory leads to certain death
    checkDeathTrajectory(myX, myY, myAngle, mySpeed, snakes) {
      const threats = [];
      
      for (const snake of snakes) {
        if (!snake || snake.id === window.slither.id) continue;
        
        // WORST CASE: Enemy can instantly boost and turn toward us
        const worstCaseAnalysis = this.analyzeWorstCaseCollision(
          myX, myY, myAngle, mySpeed,
          snake.xx, snake.yy, snake.ang, snake.sp || 5.78,
          snake
        );
        
        if (worstCaseAnalysis.isDangerous) {
          threats.push(worstCaseAnalysis);
        }
      }
      
      return threats;
    }
    
    // Analyze worst-case collision scenario
    analyzeWorstCaseCollision(myX, myY, myAngle, mySpeed, enemyX, enemyY, enemyAngle, enemySpeed, enemySnake) {
      // SCENARIO 1: Enemy maintains current trajectory
      const currentCollision = this.checkTrajectoryCollision(
        myX, myY, mySpeed, myAngle,
        enemyX, enemyY, enemySpeed, enemyAngle
      );
      
      // SCENARIO 2: Enemy instantly boosts (worst case)
      const boostCollision = this.checkTrajectoryCollision(
        myX, myY, mySpeed, myAngle,
        enemyX, enemyY, this.maxBoostSpeed, enemyAngle
      );
      
      // SCENARIO 3: Enemy turns toward us + boosts (nightmare scenario)
      const angleToUs = fastAtan2(myY - enemyY, myX - enemyX);
      const huntingCollision = this.checkTrajectoryCollision(
        myX, myY, mySpeed, myAngle,
        enemyX, enemyY, this.maxBoostSpeed, angleToUs
      );
      
      // SCENARIO 4: Check body collision (static but deadly)
      const bodyCollision = this.checkBodyCollision(myX, myY, myAngle, mySpeed, enemySnake);
      
      // Return the most dangerous scenario
      const scenarios = [currentCollision, boostCollision, huntingCollision, bodyCollision].filter(s => s.willCollide);
      
      if (scenarios.length === 0) {
        return { isDangerous: false };
      }
      
      // Find shortest time to collision (most urgent)
      const mostUrgent = scenarios.reduce((worst, current) => 
        current.timeToCollision < worst.timeToCollision ? current : worst
      );
      
      return {
        isDangerous: true,
        timeToCollision: mostUrgent.timeToCollision,
        collisionPoint: mostUrgent.collisionPoint,
        threatType: mostUrgent.threatType,
        urgencyLevel: this.calculateUrgency(mostUrgent.timeToCollision),
        enemySnake: enemySnake
      };
    }
    
    // Calculate trajectory collision (from our proven math)
    checkTrajectoryCollision(x1, y1, speed1, angle1, x2, y2, speed2, angle2) {
      const vx1 = Math.cos(angle1) * speed1;
      const vy1 = Math.sin(angle1) * speed1;
      const vx2 = Math.cos(angle2) * speed2;
      const vy2 = Math.sin(angle2) * speed2;
      
      const dx = x2 - x1;
      const dy = y2 - y1;
      const dvx = vx2 - vx1;
      const dvy = vy2 - vy1;
      
      const a = dvx * dvx + dvy * dvy;
      const b = 2 * (dx * dvx + dy * dvy);
      const c = dx * dx + dy * dy;
      
      if (Math.abs(a) < 1e-10) {
        const distance = Math.sqrt(c);
        return {
          willCollide: distance < 30,
          timeToCollision: distance < 30 ? 0 : Infinity,
          collisionPoint: { x: x1, y: y1 },
          threatType: 'static'
        };
      }
      
      const t = -b / (2 * a);
      
      if (t < 0 || t > 5.0) { // 5 second horizon
        return { willCollide: false, timeToCollision: Infinity };
      }
      
      const closestDistance = Math.sqrt(a * t * t + b * t + c);
      const collisionRadius = 25;
      
      if (closestDistance < collisionRadius) {
        return {
          willCollide: true,
          timeToCollision: t,
          collisionPoint: {
            x: x1 + vx1 * t,
            y: y1 + vy1 * t
          },
          threatType: 'trajectory'
        };
      }
      
      return { willCollide: false, timeToCollision: Infinity };
    }
    
    // Check collision with snake body
    checkBodyCollision(myX, myY, myAngle, mySpeed, enemySnake) {
      if (!enemySnake.pts) return { willCollide: false, timeToCollision: Infinity };
      
      const vx = Math.cos(myAngle) * mySpeed;
      const vy = Math.sin(myAngle) * mySpeed;
      
      let closestCollision = { willCollide: false, timeToCollision: Infinity };
      
      // Check body segments (every 3rd point for performance)
      for (let i = 0; i < enemySnake.pts.length; i += 3) {
        const bodyPart = enemySnake.pts[i];
        if (!bodyPart) continue;
        
        const dx = bodyPart.xx - myX;
        const dy = bodyPart.yy - myY;
        
        const dotProduct = dx * vx + dy * vy;
        const velocityMagnitudeSquared = vx * vx + vy * vy;
        
        if (velocityMagnitudeSquared < 1e-10) continue;
        
        const t = dotProduct / velocityMagnitudeSquared;
        
        if (t > 0 && t < 5.0) {
          const closestX = myX + vx * t;
          const closestY = myY + vy * t;
          const distance = getDistance(bodyPart.xx, bodyPart.yy, closestX, closestY);
          
          if (distance < 20 && t < closestCollision.timeToCollision) {
            closestCollision = {
              willCollide: true,
              timeToCollision: t,
              collisionPoint: { x: closestX, y: closestY },
              threatType: 'body'
            };
          }
        }
      }
      
      return closestCollision;
    }
    
    // Calculate urgency level
    calculateUrgency(timeToCollision) {
      if (timeToCollision < 0.5) return 'CRITICAL';
      if (timeToCollision < 1.0) return 'HIGH';
      if (timeToCollision < 2.0) return 'MEDIUM';
      return 'LOW';
    }

    // ==========================================
    // TRAJECTORY CORRECTION SYSTEM
    // ==========================================
    
    // Calculate minimum correction to avoid death
    calculateMinimalCorrection(myX, myY, myAngle, mySpeed, threats) {
      if (threats.length === 0) return null;
      
      // Find most urgent threat
      const urgentThreat = threats.reduce((most, current) => 
        current.timeToCollision < most.timeToCollision ? current : most
      );
      
      // If critical (< 0.5s), emergency correction
      if (urgentThreat.urgencyLevel === 'CRITICAL') {
        return this.calculateEmergencyCorrection(myX, myY, myAngle, urgentThreat);
      }
      
      // Otherwise, calculate minimal avoidance
      return this.calculateMinimalAvoidance(myX, myY, myAngle, mySpeed, urgentThreat);
    }
    
    // Emergency correction for critical situations
    calculateEmergencyCorrection(myX, myY, myAngle, threat) {
      const threatAngle = fastAtan2(threat.collisionPoint.y - myY, threat.collisionPoint.x - myX);
      
      // Turn perpendicular to threat (90° escape)
      const escapeLeft = threatAngle + Math.PI / 2;
      const escapeRight = threatAngle - Math.PI / 2;
      
      // Choose direction requiring less turning
      const leftDiff = Math.abs(angleDiff(escapeLeft, myAngle));
      const rightDiff = Math.abs(angleDiff(escapeRight, myAngle));
      
      const targetAngle = leftDiff < rightDiff ? escapeLeft : escapeRight;
      
      return {
        correctionAngle: targetAngle,
        correctionType: 'EMERGENCY',
        threat: threat,
        reason: `Critical collision in ${threat.timeToCollision.toFixed(2)}s`
      };
    }
    
    // Calculate minimal avoidance correction
    calculateMinimalAvoidance(myX, myY, myAngle, mySpeed, threat) {
      // Test small corrections to find minimum needed
      const testAngles = [];
      const angleStep = this.minCorrectionAngle;
      
      // Test angles in both directions
      for (let i = 1; i <= 8; i++) {
        testAngles.push(myAngle + angleStep * i);
        testAngles.push(myAngle - angleStep * i);
      }
      
      // Find smallest correction that avoids collision
      for (const testAngle of testAngles) {
        if (this.testTrajectoryIsSafe(myX, myY, testAngle, mySpeed, threat)) {
          return {
            correctionAngle: testAngle,
            correctionType: 'MINIMAL',
            threat: threat,
            reason: `Minimal correction: ${Math.abs(angleDiff(testAngle, myAngle)) * 180 / Math.PI}°`
          };
        }
      }
      
      // If minimal corrections don't work, use emergency
      return this.calculateEmergencyCorrection(myX, myY, myAngle, threat);
    }
    
    // Test if a trajectory is safe
    testTrajectoryIsSafe(x, y, angle, speed, threat) {
      // Re-check collision with new trajectory
      const newCollision = this.checkTrajectoryCollision(
        x, y, speed, angle,
        threat.enemySnake.xx, threat.enemySnake.yy, this.maxBoostSpeed, threat.enemySnake.ang
      );
      
      return !newCollision.willCollide;
    }

    // ==========================================
    // CONTROL TAKEOVER SYSTEM
    // ==========================================
    
    // Main update function
    update() {
      if (!this.enabled || !window.slither) return;
      
      const snake = window.slither;
      const myX = snake.xx;
      const myY = snake.yy;
      const myAngle = snake.ang;
      const mySpeed = snake.sp || 5.78;
      
      // Check for death trajectory
      const threats = this.checkDeathTrajectory(myX, myY, myAngle, mySpeed, this.getAllSnakes());
      
      if (threats.length > 0) {
        // Calculate correction
        const correction = this.calculateMinimalCorrection(myX, myY, myAngle, mySpeed, threats);
        
        if (correction) {
          this.executeCorrection(correction);
          return;
        }
      }
      
      // No threats - release control
      this.releaseControl();
    }
    
    // Execute trajectory correction
    executeCorrection(correction) {
      this.takingControl = true;
      this.correctionAngle = correction.correctionAngle;
      
      // Override mouse position
      const mouseDistance = 100;
      const newMouseX = window.slither.xx + Math.cos(this.correctionAngle) * mouseDistance;
      const newMouseY = window.slither.yy + Math.sin(this.correctionAngle) * mouseDistance;
      
      window.xm = newMouseX;
      window.ym = newMouseY;
      
      console.log(`🛡️ REACTIVE CONTROL: ${correction.correctionType} - ${correction.reason}`);
    }
    
    // Release control back to user
    releaseControl() {
      if (this.takingControl) {
        this.takingControl = false;
        console.log(`🎮 CONTROL RELEASED - Safe trajectory`);
      }
    }
    
    // Get all enemy snakes
    getAllSnakes() {
      const snakes = [];
      if (window.snakes) {
        for (let i = window.snakes.length - 1; i >= 0; i--) {
          const snake = window.snakes[i];
          if (snake && snake !== window.slither && snake.id !== -1) {
            snakes.push(snake);
          }
        }
      }
      return snakes;
    }
    
    // Toggle system on/off
    toggle() {
      this.enabled = !this.enabled;
      console.log(`🛡️ Reactive Collision Avoidance: ${this.enabled ? 'ENABLED' : 'DISABLED'}`);
      
      if (this.enabled) {
        console.log('🎯 System: Worst-case reactive protection');
        console.log('📐 Corrections: Minimal angle changes only');
        console.log('⚡ Scenarios: Current, Boost, Hunting, Body');
      }
    }
  }

  // ==========================================
  // INITIALIZATION
  // ==========================================
  
  let reactiveSystem = null;
  let gameLoopInterval = null;

  function initReactiveSystem() {
    if (reactiveSystem) return;
    
    reactiveSystem = new ReactiveCollisionAvoidance();
    
    // Start the reactive loop
    if (gameLoopInterval) clearInterval(gameLoopInterval);
    gameLoopInterval = setInterval(() => {
      reactiveSystem.update();
    }, 1000/60); // 60 FPS for precision
    
    console.log('🚀 Reactive Collision Avoidance Initialized!');
    console.log('📝 Press R to toggle reactive protection');
  }

  // Wait for game to load
  function waitForGame() {
    if (window.slither !== undefined && window.snakes !== undefined) {
      initReactiveSystem();
    } else {
      setTimeout(waitForGame, 1000);
    }
  }

  // Keyboard controls
  document.addEventListener('keydown', (e) => {
    if (e.code === 'KeyR' && reactiveSystem) {
      e.preventDefault();
      reactiveSystem.toggle();
    }
  });

  // Start when page loads
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', waitForGame);
  } else {
    waitForGame();
  }

  console.log('🛡️ Reactive Slither Bot Loaded - Waiting for game...');
})();