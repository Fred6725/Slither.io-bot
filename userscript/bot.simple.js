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

    // Check if position is dangerous (near any snake)
    isDangerous(x, y) {
      const snakes = this.getOtherSnakes();
      
      for (const snake of snakes) {
        if (!snake || !snake.xx || !snake.yy) continue;
        
        // Check head
        const headDist = getDistance(x, y, snake.xx, snake.yy);
        if (headDist < this.dangerThreshold) {
          return true;
        }
        
        // Check body parts
        if (snake.pts) {
          for (let i = 0; i < snake.pts.length; i += 2) {
            const bodyX = snake.pts[i];
            const bodyY = snake.pts[i + 1];
            const bodyDist = getDistance(x, y, bodyX, bodyY);
            if (bodyDist < this.dangerThreshold * 0.7) { // Closer to body = more dangerous
              return true;
            }
          }
        }
      }
      return false;
    }

    // Find safe direction
    findSafeDirection(myX, myY, currentAngle) {
      const checkAngles = [];
      const angleStep = Math.PI / 8; // 22.5 degrees
      
      // Check current direction first
      checkAngles.push(currentAngle);
      
      // Check nearby angles
      for (let i = 1; i <= 8; i++) {
        checkAngles.push(currentAngle + angleStep * i);
        checkAngles.push(currentAngle - angleStep * i);
      }
      
      // Find first safe direction
      for (const angle of checkAngles) {
        const checkDistance = this.dangerThreshold * 1.5;
        const checkX = myX + Math.cos(angle) * checkDistance;
        const checkY = myY + Math.sin(angle) * checkDistance;
        
        if (!this.isDangerous(checkX, checkY)) {
          return angle;
        }
      }
      
      // If nothing is safe, try opposite direction
      return currentAngle + Math.PI;
    }

    // Find nearest food
    findNearestFood(myX, myY) {
      const food = this.getFood();
      let nearest = null;
      let nearestDist = Infinity;

      for (const f of food) {
        const dist = getDistance(myX, myY, f.x, f.y);
        if (dist < this.foodThreshold && dist < nearestDist) {
          // Check if food is safe to reach
          if (!this.isDangerous(f.x, f.y)) {
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

      // Priority 1: SAFETY - avoid danger
      if (this.isDangerous(myX, myY)) {
        this.mode = 'SAFE';
        const safeDirection = this.findSafeDirection(myX, myY, currentAngle);
        console.log(`🛡️ DANGER DETECTED - Escaping`);
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
      const food = this.findNearestFood(myX, myY);
      if (food) {
        this.mode = 'FOOD';
        const foodAngle = fastAtan2(food.y - myY, food.x - myX);
        
        // Check if path to food is safe
        const pathSafe = !this.isDangerous(
          myX + Math.cos(foodAngle) * 100,
          myY + Math.sin(foodAngle) * 100
        );
        
        if (pathSafe) {
          this.lastDirection = foodAngle;
          return foodAngle;
        }
      }

      // Default: continue current direction if safe
      const checkX = myX + Math.cos(currentAngle) * 100;
      const checkY = myY + Math.sin(currentAngle) * 100;
      
      if (!this.isDangerous(checkX, checkY)) {
        this.lastDirection = currentAngle;
        return currentAngle;
      }

      // Find any safe direction
      const safeDirection = this.findSafeDirection(myX, myY, currentAngle);
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