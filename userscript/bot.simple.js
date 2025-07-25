/*
The MIT License (MIT)
 Copyright (c) 2025 Simple Slither Bot
 https://jmiller.mit-license.org/
*/
// ==UserScript==
// @name         Simple Effective Slither.io Bot
// @namespace    https://github.com/simple-slither-bot
// @version      1.0.0
// @description  Clean, Simple, Effective Slither.io Bot - No Overcomplicated Math
// @author       Simple Bot Team
// @match        http://slither.io
// @match        http://slither.com/io*
// @grant        none
// ==/UserScript==

"use strict";

(() => {
  // ==========================================
  // SIMPLE UTILITIES
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
  // SIMPLE BOT CLASS
  // ==========================================
  
  class SimpleSlitherBot {
    constructor() {
      this.enabled = false;
      this.mode = 'SAFE'; // SAFE, FOOD, ATTACK
      this.lastDirection = 0;
      this.dangerThreshold = 200; // Distance to consider dangerous
      this.foodThreshold = 300; // Distance to look for food
    }

    // TRAJECTORY COLLISION MATH (from our advanced version)
    checkTrajectoryCollision(x1, y1, speed1, angle1, x2, y2, speed2, angle2, timeHorizon) {
      // Convert to velocity vectors
      const vx1 = Math.cos(angle1) * speed1;
      const vy1 = Math.sin(angle1) * speed1;
      const vx2 = Math.cos(angle2) * speed2;
      const vy2 = Math.sin(angle2) * speed2;
      
      // Relative position and velocity
      const dx = x2 - x1;
      const dy = y2 - y1;
      const dvx = vx2 - vx1;
      const dvy = vy2 - vy1;
      
      // Quadratic equation coefficients for closest approach
      const a = dvx * dvx + dvy * dvy;
      const b = 2 * (dx * dvx + dy * dvy);
      const c = dx * dx + dy * dy;
      
      // If velocities are identical, check current distance
      if (Math.abs(a) < 1e-10) {
        const distance = Math.sqrt(c);
        const collisionRadius = 30; // Snake collision radius
        return {
          willCollide: distance < collisionRadius,
          timeToCollision: distance < collisionRadius ? 0 : Infinity,
          closestDistance: distance
        };
      }
      
      // Time of closest approach
      const t = -b / (2 * a);
      
      // Check if collision happens within time horizon
      if (t < 0 || t > timeHorizon) {
        return { willCollide: false, timeToCollision: Infinity, closestDistance: Infinity };
      }
      
      // Distance at closest approach
      const closestDistance = Math.sqrt(a * t * t + b * t + c);
      const collisionRadius = 25; // Collision threshold
      
      return {
        willCollide: closestDistance < collisionRadius,
        timeToCollision: closestDistance < collisionRadius ? t : Infinity,
        closestDistance: closestDistance
      };
    }
    
    // Check collision with static point (body parts)
    checkLineToPointCollision(x, y, speed, angle, pointX, pointY, timeHorizon) {
      const vx = Math.cos(angle) * speed;
      const vy = Math.sin(angle) * speed;
      
      // Vector from current position to point
      const dx = pointX - x;
      const dy = pointY - y;
      
      // Project point onto trajectory line
      const dotProduct = dx * vx + dy * vy;
      const velocityMagnitudeSquared = vx * vx + vy * vy;
      
      if (velocityMagnitudeSquared < 1e-10) {
        return { willCollide: false, timeToCollision: Infinity };
      }
      
      const t = dotProduct / velocityMagnitudeSquared;
      
      // Check if collision point is in the future and within time horizon
      if (t < 0 || t > timeHorizon) {
        return { willCollide: false, timeToCollision: Infinity };
      }
      
      // Calculate closest point on trajectory
      const closestX = x + vx * t;
      const closestY = y + vy * t;
      
      // Distance from point to trajectory
      const distance = getDistance(pointX, pointY, closestX, closestY);
      const collisionRadius = 20; // Body collision radius
      
      return {
        willCollide: distance < collisionRadius,
        timeToCollision: distance < collisionRadius ? t : Infinity
      };
    }

    // Get our snake
    getMySnake() {
      return window.snake;
    }

    // Get all other snakes
    getOtherSnakes() {
      const snakes = [];
      if (window.snakes) {
        for (let i = window.snakes.length - 1; i >= 0; i--) {
          const snake = window.snakes[i];
          if (snake && snake !== this.getMySnake() && snake.id !== -1) {
            snakes.push(snake);
          }
        }
      }
      return snakes;
    }

    // Get all food
    getFood() {
      const food = [];
      if (window.foods) {
        for (let i = window.foods.length - 1; i >= 0; i--) {
          const f = window.foods[i];
          if (f && f.rx && f.ry) {
            food.push({ x: f.rx, y: f.ry, size: f.sz || 5 });
          }
        }
      }
      return food;
    }

    // IMPROVED: Check if trajectory leads to collision (not just distance)
    isDangerous(x, y, mySpeed, myAngle, timeHorizon = 2.0) {
      const mySnake = this.getMySnake();
      const snakes = this.getOtherSnakes();
      
      for (const snake of snakes) {
        if (!snake || !snake.xx || !snake.yy) continue;
        
        // Skip our own snake parts (fix for detecting own head)
        if (snake.id === mySnake.id) continue;
        
        // Get enemy trajectory
        const enemySpeed = snake.sp || 5.78;
        const enemyAngle = snake.ang || 0;
        
        // Check trajectory collision with enemy HEAD
        const headCollision = this.checkTrajectoryCollision(
          x, y, mySpeed, myAngle,
          snake.xx, snake.yy, enemySpeed, enemyAngle,
          timeHorizon
        );
        
        if (headCollision.willCollide && headCollision.timeToCollision < timeHorizon) {
          return { 
            dangerous: true, 
            type: 'HEAD', 
            timeToCollision: headCollision.timeToCollision,
            snake: snake 
          };
        }
        
        // Check body collision (static obstacles)
        if (snake.pts) {
          for (let i = 0; i < snake.pts.length; i += 2) {
            const bodyX = snake.pts[i];
            const bodyY = snake.pts[i + 1];
            
            // Check if our trajectory passes through body
            const bodyCollision = this.checkLineToPointCollision(
              x, y, mySpeed, myAngle, bodyX, bodyY, timeHorizon
            );
            
            if (bodyCollision.willCollide) {
              return { 
                dangerous: true, 
                type: 'BODY', 
                timeToCollision: bodyCollision.timeToCollision,
                snake: snake 
              };
            }
          }
        }
      }
      return { dangerous: false };
    }

    // Find safe direction using trajectory analysis
    findSafeDirection(myX, myY, currentAngle, mySpeed) {
      const checkAngles = [];
      const angleStep = Math.PI / 12; // 15 degrees - more precision
      
      // Check current direction first
      checkAngles.push(currentAngle);
      
      // Check nearby angles
      for (let i = 1; i <= 12; i++) {
        checkAngles.push(currentAngle + angleStep * i);
        checkAngles.push(currentAngle - angleStep * i);
      }
      
      // Adjust time horizon based on speed (boost detection fix!)
      const timeHorizon = mySpeed > 7 ? 1.0 : 2.0; // Shorter horizon when boosting
      
      // Find safest direction (considering time to collision)
      let bestAngle = currentAngle;
      let bestTimeToCollision = 0;
      
      for (const angle of checkAngles) {
        const danger = this.isDangerous(myX, myY, mySpeed, angle, timeHorizon);
        
        if (!danger.dangerous) {
          return angle; // Found completely safe direction
        } else if (danger.timeToCollision > bestTimeToCollision) {
          // This direction gives us more time before collision
          bestAngle = angle;
          bestTimeToCollision = danger.timeToCollision;
        }
      }
      
      // If no perfectly safe direction, choose the one that gives most time
      return bestAngle;
    }

    // Find nearest safe food using trajectory
    findNearestFood(myX, myY, mySpeed) {
      const food = this.getFood();
      let nearest = null;
      let nearestDist = Infinity;

      for (const f of food) {
        const dist = getDistance(myX, myY, f.x, f.y);
        if (dist < this.foodThreshold && dist < nearestDist) {
          // Check if trajectory to food is safe
          const foodAngle = fastAtan2(f.y - myY, f.x - myX);
          const danger = this.isDangerous(myX, myY, mySpeed, foodAngle);
          
          if (!danger.dangerous) {
            nearest = f;
            nearestDist = dist;
          }
        }
      }

      return nearest;
    }

    // Find attack opportunity
    findAttackTarget(myX, myY) {
      const snakes = this.getOtherSnakes();
      const mySnake = this.getMySnake();
      
      if (!mySnake) return null;
      
      const mySize = mySnake.sc || 1;

      for (const snake of snakes) {
        if (!snake || !snake.xx || !snake.yy) continue;
        
        const dist = getDistance(myX, myY, snake.xx, snake.yy);
        const enemySize = snake.sc || 1;
        
        // Only attack if we're bigger and close
        if (mySize > enemySize * 1.2 && dist < 150) {
          // Check if enemy is vulnerable (not heading towards us)
          const angleToEnemy = fastAtan2(snake.yy - myY, snake.xx - myX);
          const enemyHeading = snake.ang || 0;
          const angleToMe = fastAtan2(myY - snake.yy, myX - snake.xx);
          
          const enemyHeadingDiff = Math.abs(angleDiff(enemyHeading, angleToMe));
          
          // Enemy not looking at us = vulnerable
          if (enemyHeadingDiff > Math.PI / 2) {
            return { x: snake.xx, y: snake.yy, angle: angleToEnemy };
          }
        }
      }
      
      return null;
    }

    // Main control function
    calculateDirection() {
      const mySnake = this.getMySnake();
      if (!mySnake || !mySnake.xx || !mySnake.yy) return this.lastDirection;

      const myX = mySnake.xx;
      const myY = mySnake.yy;
      const currentAngle = mySnake.ang || 0;
      const mySpeed = mySnake.sp || 5.78;

      // Priority 1: SAFETY - check trajectory-based danger
      const currentDanger = this.isDangerous(myX, myY, mySpeed, currentAngle);
      
      if (currentDanger.dangerous) {
        this.mode = 'SAFE';
        const safeDirection = this.findSafeDirection(myX, myY, currentAngle, mySpeed);
        console.log(`🛡️ TRAJECTORY DANGER: ${currentDanger.type} in ${currentDanger.timeToCollision.toFixed(2)}s - Escaping`);
        this.lastDirection = safeDirection;
        return safeDirection;
      }

      // Priority 2: ATTACK - if opportunity exists
      const attackTarget = this.findAttackTarget(myX, myY);
      if (attackTarget) {
        this.mode = 'ATTACK';
        console.log(`⚔️ ATTACK OPPORTUNITY`);
        this.lastDirection = attackTarget.angle;
        return attackTarget.angle;
      }

      // Priority 3: FOOD - collect food
      const food = this.findNearestFood(myX, myY, mySpeed);
      if (food) {
        this.mode = 'FOOD';
        const foodAngle = fastAtan2(food.y - myY, food.x - myX);
        
        // Check if trajectory to food is safe
        const foodDanger = this.isDangerous(myX, myY, mySpeed, foodAngle);
        
        if (!foodDanger.dangerous) {
          this.lastDirection = foodAngle;
          return foodAngle;
        }
      }

      // Default: continue current direction if trajectory is safe
      const continueDanger = this.isDangerous(myX, myY, mySpeed, currentAngle);
      
      if (!continueDanger.dangerous) {
        this.lastDirection = currentAngle;
        return currentAngle;
      }

      // Find any safe direction
      const safeDirection = this.findSafeDirection(myX, myY, currentAngle, mySpeed);
      this.lastDirection = safeDirection;
      return safeDirection;
    }

    // Main update function
    update() {
      if (!this.enabled || !window.playing) return;

      try {
        const targetAngle = this.calculateDirection();
        
        // Apply the direction smoothly
        if (window.snake) {
          const currentAngle = window.snake.ang || 0;
          const angleDifference = angleDiff(targetAngle, currentAngle);
          
          // Smooth turning
          const maxTurnRate = 0.3; // Radians per frame
          let newAngle = currentAngle;
          
          if (Math.abs(angleDifference) > maxTurnRate) {
            newAngle = currentAngle + Math.sign(angleDifference) * maxTurnRate;
          } else {
            newAngle = targetAngle;
          }
          
          // Set mouse position based on angle
          const mouseDistance = 100;
          const mouseX = window.snake.xx + Math.cos(newAngle) * mouseDistance;
          const mouseY = window.snake.yy + Math.sin(newAngle) * mouseDistance;
          
          window.xm = mouseX;
          window.ym = mouseY;
        }
      } catch (error) {
        console.error("Bot error:", error);
      }
    }

    // Toggle bot on/off
    toggle() {
      this.enabled = !this.enabled;
      console.log(`🤖 Simple Bot: ${this.enabled ? 'ENABLED' : 'DISABLED'}`);
      
      if (this.enabled) {
        console.log('🎯 Mode Priority: 1️⃣ Safety 2️⃣ Attack 3️⃣ Food');
      }
    }
  }

  // ==========================================
  // INITIALIZATION
  // ==========================================
  
  let bot = null;
  let gameLoopInterval = null;

  function initBot() {
    if (bot) return;
    
    bot = new SimpleSlitherBot();
    
    // Start the game loop
    if (gameLoopInterval) clearInterval(gameLoopInterval);
    gameLoopInterval = setInterval(() => {
      bot.update();
    }, 1000/30); // 30 FPS
    
    console.log('🚀 Simple Slither Bot Initialized!');
    console.log('📝 Press SPACE to toggle bot on/off');
  }

  // Wait for game to load
  function waitForGame() {
    if (window.snake !== undefined && window.snakes !== undefined) {
      initBot();
    } else {
      setTimeout(waitForGame, 1000);
    }
  }

  // Keyboard controls
  document.addEventListener('keydown', (e) => {
    if (e.code === 'Space' && bot) {
      e.preventDefault();
      bot.toggle();
    }
  });

  // Start when page loads
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', waitForGame);
  } else {
    waitForGame();
  }

  console.log('🎮 Simple Slither Bot Loaded - Waiting for game...');
})();