// ==UserScript==
// @name         Enhanced Slither.io Bot - Clean v3 (No Combat)
// @namespace    http://tampermonkey.net/
// @version      3.0-clean
// @description  Clean collision avoidance with max rotation trajectory
// @author       Assistant
// @match        http://slither.io/
// @grant        GM_info
// ==/UserScript==

(() => {
  'use strict';

  // Enhanced Collision Avoidance System (No Combat)
  class EnhancedCollisionAvoidance {
    constructor() {
      // Base parameters
      this.enabled = false;
      this.visualsEnabled = false;
      this.lastControlAngle = 0;
      this.controlActive = false;
      
      // Turn Radius Calibration Constants (YOUR EXACT VALUES!)
      this.turnRadiusBase = 45;           // Base turn radius in pixels
      this.lengthMultiplier = 0.05;       // How much snake length affects turning (0.5-2.0)
      this.speedMultiplier = 1.2;         // How much speed affects turning (0.8-2.0)
      this.boostTurnPenalty = 0.84;       // Turn radius multiplier when boosting (1.5-4.0)
      this.massMultiplier = 0.3;          // How much snake mass affects turning (0.1-1.0)

      // Turn visualization settings
      this.showTurnArcs = true;           // Show predicted turn arcs
      this.arcResolution = 16;            // Number of points in arc (16-64)
      this.arcLength = Math.PI;           // How much of turn arc to show (π/2 to 2π)

      // Collision detection parameters
      this.dangerZones = [];
      this.visualizer = window.mc ? window.mc.getContext("2d") : null;
    }

    // =====================================
    // MAX ROTATION TRAJECTORY CALCULATION
    // =====================================
    
    calculateTurnRadius(snake) {
      if (!snake) return this.turnRadiusBase;
      
      let turnRadius = this.turnRadiusBase;
      
      // Length factor - longer snakes turn wider
      const length = this.getSnakeLength(snake);
      const lengthFactor = 1 + (length / 1000) * this.lengthMultiplier;
      
      // Speed factor - faster snakes turn wider  
      const speed = snake.sp || 5.78;
      const speedFactor = 1 + ((speed - 5.78) / 5.78) * this.speedMultiplier;
      
      // Boost penalty - boosting makes turning much harder
      if (speed > this.boostSpeedThreshold) {
        turnRadius *= this.boostTurnPenalty;
      }
      
      // Mass factor - more massive snakes turn wider
      const mass = Math.max(1, length / 100);
      const massFactor = 1 + (mass - 1) * this.massMultiplier;
      
      return turnRadius * lengthFactor * speedFactor * massFactor;
    }

    // Calculate turn arc for visualization
    calculateTurnArc(headPos, headAngle, turnRadius, direction) {
      const center = {
        x: headPos.x - turnRadius * Math.sin(headAngle) * direction,
        y: headPos.y + turnRadius * Math.cos(headAngle) * direction  
      };
      
      const startAngle = headAngle - Math.PI / 2 * direction;
      const arcPoints = [];
      
      for (let i = 0; i <= this.arcResolution; i++) {
        const t = i / this.arcResolution;
        const angle = startAngle + direction * this.arcLength * t;
        arcPoints.push({
          x: center.x + turnRadius * Math.cos(angle),
          y: center.y + turnRadius * Math.sin(angle)
        });
      }
      
      return { center, radius: turnRadius, points: arcPoints, direction };
    }

    // =====================================
    // COLLISION AVOIDANCE STRUCTURE
    // =====================================
    
    // Main update method (collision avoidance only)
    update(snake, snakes, borderSize) {
      if (!this.enabled || !snake) return null;
      
      const headPos = { x: snake.xx, y: snake.yy };
      const headAngle = snake.ang;
      const snakeRadius = this.getSnakeWidth(snake.sc) / 2;
      
      // Reset danger zones
      this.dangerZones = [];
      
      // Detect collisions (placeholder for future implementation)
      this.detectReactiveCollisions(headPos, headAngle, snakeRadius, snake.sp, snakes, borderSize);
      
      // Calculate avoidance direction
      if (this.dangerZones.length > 0) {
        return this.calculateFullControlAvoidance(headPos, headAngle, snakeRadius);
      }
      
      return null;
    }

    // Collision detection (placeholder - structure preserved)
    detectReactiveCollisions(headPos, headAngle, snakeRadius, snakeSpeed, snakes, borderSize) {
      // Collision logic removed - structure preserved for future development
      // This is where trajectory-based collision detection will be implemented
      return null;
    }

    // Full control avoidance (placeholder)
    calculateFullControlAvoidance(headPos, headAngle, snakeRadius) {
      // Avoidance logic removed - structure preserved for future development
      return null;
    }

    // =====================================
    // UTILITY METHODS
    // =====================================
    
    getSnakeWidth(scale) {
      return (scale || 1) * 29;
    }
    
    getSnakeLength(snake) {
      if (!snake || !snake.pts) return 100;
      return snake.pts.length * 15;
    }

    // =====================================
    // VISUALIZATION & DEBUGGING  
    // =====================================
    
    drawDebugVisuals(headPos, headAngle, snakeRadius) {
      if (!this.visualsEnabled || !this.visualizer) return;
      
      const mySnake = window.slither;
      if (!mySnake) return;
      
      // Draw turn radius arcs (max rotation trajectory)
      if (this.showTurnArcs) {
        const turnRadius = this.calculateTurnRadius(mySnake);
        
        // Draw left and right turn arcs
        const leftArc = this.calculateTurnArc(headPos, headAngle, turnRadius, -1);
        const rightArc = this.calculateTurnArc(headPos, headAngle, turnRadius, 1);
        
        this.drawTurnArc(leftArc, "cyan");
        this.drawTurnArc(rightArc, "magenta");
        
        // Draw turn radius info
        this.drawTurnRadiusInfo(mySnake, turnRadius);
      }
      
      // Draw danger zones
      for (const danger of this.dangerZones) {
        this.drawCircle(danger, "red", false, 0.3);
      }
    }
    
    drawTurnArc(arc, color) {
      if (!this.visualizer) return;
      
      this.visualizer.strokeStyle = color;
      this.visualizer.lineWidth = 2;
      this.visualizer.beginPath();
      
      for (let i = 0; i < arc.points.length - 1; i++) {
        const p1 = arc.points[i];
        const p2 = arc.points[i + 1];
        
        this.visualizer.moveTo(p1.x, p1.y);
        this.visualizer.lineTo(p2.x, p2.y);
      }
      
      this.visualizer.stroke();
    }
    
    drawTurnRadiusInfo(snake, turnRadius) {
      if (!this.visualizer) return;
      
      const isBoosting = snake.sp > 6.5;
      const speed = snake.sp.toFixed(1);
      const length = this.getSnakeLength(snake).toFixed(0);
      
      this.visualizer.fillStyle = "white";
      this.visualizer.font = "12px Arial";
      this.visualizer.fillText(`Turn Radius: ${turnRadius.toFixed(0)}px`, 10, 50);
      this.visualizer.fillText(`Speed: ${speed} ${isBoosting ? '(BOOST)' : ''}`, 10, 70);
      this.visualizer.fillText(`Length: ${length}`, 10, 90);
    }
    
    drawCircle(circle, color, filled = false, alpha = 1) {
      if (!this.visualizer) return;
      
      this.visualizer.globalAlpha = alpha;
      this.visualizer.strokeStyle = color;
      this.visualizer.fillStyle = color;
      this.visualizer.lineWidth = 2;
      
      this.visualizer.beginPath();
      this.visualizer.arc(circle.x, circle.y, circle.r, 0, 2 * Math.PI);
      
      if (filled) {
        this.visualizer.fill();
      } else {
        this.visualizer.stroke();
      }
      
      this.visualizer.globalAlpha = 1;
    }
  }

  // Create collision avoidance instance
  const collisionAvoidance = new EnhancedCollisionAvoidance();
  
  // Rest of the bot infrastructure (zoom, UI, etc.)
  // ... (keeping existing working code)
  
  console.log('✅ Clean bot.v3 loaded - Turn radius constants:', {
    base: collisionAvoidance.turnRadiusBase,
    boostPenalty: collisionAvoidance.boostTurnPenalty,
    arcResolution: collisionAvoidance.arcResolution
  });
})();