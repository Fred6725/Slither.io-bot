/*
The MIT License (MIT)
 Copyright (c) 2025 saya <saya.38slither@gmail.com>
 Copyright (c) 2016 Jesse Miller <jmiller@jmiller.com>
 Copyright (c) 2016 Alexey Korepanov <kaikaikai@yandex.ru>
 Copyright (c) 2016 Ermiya Eskandary & Theophile Cailliau and other contributors
 https://jmiller.mit-license.org/
*/
// ==UserScript==
// @name         Enhanced Slither.io Bot - Moving Target Collision Avoidance
// @namespace    https://github.com/enhanced-slither-collision
// @version      4.1.0
// @description  Complete Slither.io Bot with Enhanced Moving Target Collision Avoidance and Mouse Input Blending
// @author       Enhanced Bot Team (based on saya's work)
// @match        http://slither.io
// @match        http://slither.com/io*
// @grant        none
// ==/UserScript==

"use strict";
(() => {
  // src/bot/canvas.ts
  var fastAtan2 = (y, x) => {
    const QPI = Math.PI / 4;
    const TQPI = 3 * Math.PI / 4;
    let r = 0;
    let angle = 0;
    const abs_y = Math.abs(y) + 1e-10;
    if (x < 0) {
      r = (x + abs_y) / (abs_y - x);
      angle = TQPI;
    } else {
      r = (x - abs_y) / (x + abs_y);
      angle = QPI;
    }
    angle += (0.1963 * r * r - 0.9817) * r;
    if (y < 0) {
      return -angle;
    }
    return angle;
  };
  var isLeft = (start, end, point) => {
    return (end.x - start.x) * (point.y - start.y) - (end.y - start.y) * (point.x - start.x) > 0;
  };
  var getDistance2 = (x1, y1, x2, y2) => {
    return (x1 - x2) ** 2 + (y1 - y2) ** 2;
  };
  var unitVector = (v) => {
    const l = Math.sqrt(v.x * v.x + v.y * v.y);
    return l > 0 ? { x: v.x / l, y: v.y / l } : { x: 0, y: 0 };
  };
  var pointInPoly = (point, poly) => {
    if (point.x < poly.minx || point.x > poly.maxx || point.y < poly.miny || point.y > poly.maxy) {
      return false;
    }
    let c = false;
    const pts = poly.pts;
    const l = pts.length;
    for (let i = 0, j = l - 1; i < l; j = i++) {
      if (pts[i].y > point.y !== pts[j].y > point.y && point.x < (pts[j].x - pts[i].x) * (point.y - pts[i].y) / (pts[j].y - pts[i].y) + pts[i].x) {
        c = !c;
      }
    }
    return c;
  };
  var addPolyBox = (poly) => {
    const pts = poly.pts;
    let minx = pts[0].x;
    let maxx = pts[0].x;
    let miny = pts[0].y;
    let maxy = pts[0].y;
    for (let p = 1, l = pts.length; p < l; p++) {
      if (pts[p].x < minx) {
        minx = pts[p].x;
      }
      if (pts[p].x > maxx) {
        maxx = pts[p].x;
      }
      if (pts[p].y < miny) {
        miny = pts[p].y;
      }
      if (pts[p].y > maxy) {
        maxy = pts[p].y;
      }
    }
    return {
      pts,
      minx,
      maxx,
      miny,
      maxy
    };
  };
  var cross = (o, a, b) => {
    return (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
  };
  var convexHullSort = (a, b) => {
    return a.x === b.x ? a.y - b.y : a.x - b.x;
  };
  var convexHull = (points) => {
    points.sort(convexHullSort);
    const lower = [];
    for (let i = 0, l = points.length; i < l; i++) {
      while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], points[i]) <= 0) {
        lower.pop();
      }
      lower.push(points[i]);
    }
    const upper = [];
    for (let i = points.length - 1; i >= 0; i--) {
      while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], points[i]) <= 0) {
        upper.pop();
      }
      upper.push(points[i]);
    }
    upper.pop();
    lower.pop();
    return lower.concat(upper);
  };

  // src/bot/visualizer.ts
  var TAU = 2 * Math.PI;
  var roundedPoint = (point) => ({
    x: Math.round(point.x),
    y: Math.round(point.y)
  });
  var roundedCircle = (circle) => ({
    x: Math.round(circle.x),
    y: Math.round(circle.y),
    r: Math.round(circle.r)
  });
  var roundedRect = (rect) => ({
    x: Math.round(rect.x),
    y: Math.round(rect.y),
    w: Math.round(rect.w),
    h: Math.round(rect.h)
  });
  var scaled = (scalar) => scalar * window.gsc;
  var mapToCanvas = (point) => ({
    x: window.mww2 + scaled(point.x - window.view_xx),
    y: window.mhh2 + scaled(point.y - window.view_yy)
  });
  var getContext = (canvas = document.createElement("canvas")) => {
    const ctx = canvas.getContext("2d");
    if (ctx === null) {
      throw new Error("Failed to get canvas context");
    }
    return ctx;
  };
  var Visualizer = class {
    enabled = true;
    ctx;
    constructor(ctx = getContext()) {
      this.ctx = ctx;
    }
    setContext(ctx) {
      this.ctx = ctx;
    }
    drawLine(start, end, color, width = 2) {
      if (!this.enabled) return;
      const ctx = this.ctx;
      const p1 = roundedPoint(mapToCanvas(start));
      const p2 = roundedPoint(mapToCanvas(end));
      const w = scaled(width);
      ctx.save();
      ctx.lineWidth = w;
      ctx.strokeStyle = color;
      ctx.beginPath();
      ctx.moveTo(p1.x, p1.y);
      ctx.lineTo(p2.x, p2.y);
      ctx.stroke();
      ctx.restore();
    }
    drawCircle(circle, color, fill = false, alpha = 1) {
      if (!this.enabled) return;
      const ctx = this.ctx;
      const p = mapToCanvas(circle);
      const { x, y, r } = roundedCircle({
        x: p.x,
        y: p.y,
        r: scaled(circle.r)
      });
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.strokeStyle = color;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, TAU);
      if (fill) {
        ctx.fillStyle = color;
        ctx.fill();
      }
      ctx.stroke();
      ctx.restore();
    }
    drawRect(rect, color, fill = false, alpha = 1) {
      if (!this.enabled) return;
      const ctx = this.ctx;
      const p = mapToCanvas(rect);
      const { x, y, w, h } = roundedRect({
        x: p.x,
        y: p.y,
        w: scaled(rect.w),
        h: scaled(rect.h)
      });
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.strokeStyle = color;
      if (fill) {
        ctx.fillStyle = color;
        ctx.fillRect(x, y, w, h);
      }
      ctx.strokeRect(x, y, w, h);
      ctx.restore();
    }
  };

  // Enhanced Collision Avoidance System with Moving Target Prediction
  var CollisionAvoidance = class {
    enabled = false;
    visualsEnabled = false;
    visualizer;

    // Full control mode - like bot mode but user controls speed
    fullControlMode = true; // Changed from frame-by-frame correction to full control

    // Collision detection parameters (will be adjusted dynamically)
    baseLookaheadDistance = 200;
    baseDangerZoneRadius = 120;
    baseSafetyMargin = 60;
    maxSteeringAngle = Math.PI / 2; // 90 degrees max steering
    smoothingFactor = 0.5;

    // Moving target prediction parameters
    predictionTimeHorizon = 1.0; // seconds
    boostSpeedThreshold = 6.5;
    maxBoostSpeed = 12.0;

    // Full control mode parameters
    controlSmoothingFactor = 0.3;
    lastControlAngle = 0;
    controlActive = false;

    // Dynamic parameters (calculated each frame)
    lookaheadDistance = 200;
    dangerZoneRadius = 120;
    safetyMargin = 60;

    // Collision prediction data
    dangerZones = [];
    avoidanceVector = { x: 0, y: 0 };
    lastCorrectionAngle = 0;

    // Snake movement history for prediction
    snakeHistory = new Map();

    constructor(visualizer) {
      this.visualizer = visualizer;
    }

    // Main collision avoidance update function
    update(snake, snakes, borderSize) {
      if (!this.enabled || !snake) return null;

      this.dangerZones = [];
      const headPos = { x: snake.xx, y: snake.yy };
      const headAngle = snake.ang;
      const snakeRadius = this.getSnakeWidth(snake.sc) / 2;

      // Update snake movement history
      this.updateSnakeHistory(snakes);

      // Adjust parameters based on speed and snake size
      this.adjustDynamicParameters(snake);

      // Predict collision dangers with moving target prediction
      this.predictEnhancedCollisions(headPos, headAngle, snakeRadius, snake.sp, snakes, borderSize);

      // Debug output
      if (this.dangerZones.length > 0) {
        const isBoosting = snake.sp > 6.0;
        console.log(`Enhanced Collision Avoidance: ${this.dangerZones.length} dangers, closest: ${this.dangerZones[0]?.distance?.toFixed(0)}px, boost: ${isBoosting}`);
      }

      // Calculate avoidance direction for full control mode
      const avoidanceAngle = this.calculateFullControlAvoidance(headPos, headAngle, snakeRadius);

      // Apply visual debugging if enabled
      if (this.visualsEnabled) {
        this.drawDebugVisuals(headPos, headAngle, snakeRadius);
      }

      return avoidanceAngle;
    }

    // Update snake movement history for prediction
    updateSnakeHistory(snakes) {
      const currentTime = Date.now();

      for (const snake of snakes) {
        if (!snake || snake.id === window.slither.id) continue;

        const snakeId = snake.id;
        const currentSpeed = snake.sp || 5.78;
        const isBoosting = currentSpeed > this.boostSpeedThreshold;

        if (!this.snakeHistory.has(snakeId)) {
          this.snakeHistory.set(snakeId, []);
        }

        const history = this.snakeHistory.get(snakeId);
        history.push({
          time: currentTime,
          position: { x: snake.xx, y: snake.yy },
          angle: snake.ang,
          speed: currentSpeed,
          isBoosting: isBoosting,
          mass: snake.sc
        });

        // Keep only recent history (last 3 seconds)
        const historyLimit = currentTime - 3000;
        this.snakeHistory.set(snakeId, history.filter(entry => entry.time > historyLimit));
      }
    }

    // Predict snake position based on movement history
    predictSnakePosition(snake, timeHorizon) {
      const history = this.snakeHistory.get(snake.id);
      if (!history || history.length < 2) {
        // No history - use current position and angle for basic prediction
        const currentSpeed = snake.sp || 5.78;
        return {
          x: snake.xx + Math.cos(snake.ang) * currentSpeed * timeHorizon * 60,
          y: snake.yy + Math.sin(snake.ang) * currentSpeed * timeHorizon * 60
        };
      }

      // Use movement history for better prediction
      const recent = history.slice(-3);
      const latest = recent[recent.length - 1];

      // Calculate average velocity
      let avgVelocity = { x: 0, y: 0 };
      for (let i = 1; i < recent.length; i++) {
        const dt = (recent[i].time - recent[i-1].time) / 1000;
        if (dt > 0) {
          avgVelocity.x += (recent[i].position.x - recent[i-1].position.x) / dt;
          avgVelocity.y += (recent[i].position.y - recent[i-1].position.y) / dt;
        }
      }

      avgVelocity.x /= (recent.length - 1);
      avgVelocity.y /= (recent.length - 1);

      // Predict future position
      return {
        x: latest.position.x + avgVelocity.x * timeHorizon,
        y: latest.position.y + avgVelocity.y * timeHorizon
      };
    }

    // Adjust collision parameters based on snake speed and size
    adjustDynamicParameters(snake) {
      const speedMultiplier = snake.sp / 5.78; // Base speed is 5.78
      const isBoosting = snake.sp > 6.0;
      const sizeMultiplier = Math.max(0.5, snake.sc / 10);

      // Increase lookahead distance when boosting or moving fast
      this.lookaheadDistance = this.baseLookaheadDistance * (isBoosting ? 3.5 : speedMultiplier);

      // Increase danger zone when boosting
      this.dangerZoneRadius = this.baseDangerZoneRadius * (isBoosting ? 2.0 : 1.5);

      // Increase safety margin based on speed and size
      this.safetyMargin = this.baseSafetyMargin * speedMultiplier * sizeMultiplier;

      // More aggressive steering when boosting
      this.maxSteeringAngle = isBoosting ? Math.PI : Math.PI / 2;
      this.smoothingFactor = isBoosting ? 0.8 : 0.5;
    }

    // Enhanced collision prediction with moving target support
    predictEnhancedCollisions(headPos, headAngle, snakeRadius, snakeSpeed, snakes, borderSize) {
      const lookAheadVector = {
        x: Math.cos(headAngle) * this.lookaheadDistance,
        y: Math.sin(headAngle) * this.lookaheadDistance
      };

      // Check collision with other snakes using moving target prediction
      for (const snake of snakes) {
        if (!snake || snake.id === window.slither.id) continue;

        const currentSpeed = snake.sp || 5.78;
        const isBoosting = currentSpeed > this.boostSpeedThreshold;

        // Predict where the snake will be
        const predictedPosition = this.predictSnakePosition(snake, this.predictionTimeHorizon);
        const predictedSpeed = isBoosting ? Math.min(currentSpeed * 1.2, this.maxBoostSpeed) : currentSpeed;

        // Create prediction object
        const prediction = {
          currentlyBoosting: isBoosting,
          willBoost: isBoosting,
          confidence: isBoosting ? 0.9 : 0.5,
          predictedSpeed: predictedSpeed,
          predictedPosition: predictedPosition
        };

        this.checkEnhancedSnakeCollision(headPos, lookAheadVector, snakeRadius, snakeSpeed, snake, predictedSpeed, prediction);
      }

      // Check collision with borders
      this.checkBorderCollision(headPos, lookAheadVector, snakeRadius, borderSize);
    }

    // Enhanced snake collision detection with moving target prediction
    checkEnhancedSnakeCollision(headPos, lookAheadVector, snakeRadius, snakeSpeed, targetSnake, predictedSpeed, prediction) {
      if (!targetSnake.pts || targetSnake.pts.length < 1) return;

      const targetRadius = this.getSnakeWidth(targetSnake.sc) / 2;
      const baseSafeDistance = snakeRadius + targetRadius + this.safetyMargin;

      // Dynamic safety distance based on boost predictions
      const speedMultiplier = prediction.currentlyBoosting ? 2.0 : 1.0;
      const safeDistance = baseSafeDistance * speedMultiplier;

      // Check collision with predicted head position
      const predictedPos = prediction.predictedPosition;
      if (predictedPos) {
        const headDistance = Math.sqrt(getDistance2(headPos.x, headPos.y, predictedPos.x, predictedPos.y));
        if (headDistance < safeDistance) {
          const approachAngle = this.calculateApproachAngle(headPos, predictedPos, lookAheadVector);
          const dangerLevel = this.calculateDangerLevel(headDistance, safeDistance, approachAngle);

          this.dangerZones.push({
            point: predictedPos,
            originalPoint: { x: targetSnake.xx, y: targetSnake.yy },
            distance: headDistance,
            radius: safeDistance,
            approachAngle: approachAngle,
            dangerLevel: dangerLevel,
            type: 'moving_snake',
            isBoosting: prediction.currentlyBoosting,
            predictedSpeed: predictedSpeed,
            boostPrediction: prediction,
            snakeId: targetSnake.id
          });
        }
      }

      // Check collision with current head position (fallback)
      const currentHeadDistance = Math.sqrt(getDistance2(headPos.x, headPos.y, targetSnake.xx, targetSnake.yy));
      if (currentHeadDistance < safeDistance) {
        const approachAngle = this.calculateApproachAngle(headPos, { x: targetSnake.xx, y: targetSnake.yy }, lookAheadVector);
        const dangerLevel = this.calculateDangerLevel(currentHeadDistance, safeDistance, approachAngle);

        this.dangerZones.push({
          point: { x: targetSnake.xx, y: targetSnake.yy },
          distance: currentHeadDistance,
          radius: safeDistance,
          approachAngle: approachAngle,
          dangerLevel: dangerLevel,
          type: 'snake',
          isBoosting: prediction.currentlyBoosting,
          predictedSpeed: predictedSpeed,
          snakeId: targetSnake.id
        });
      }

      // Check snake body collision - mark dangerous body parts with orange dots
      const pts = targetSnake.pts;
      for (let i = 0; i < pts.length; i++) {
        const bodyPart = pts[i];
        if (!bodyPart || bodyPart.dying) continue;

        const bodyDistance = Math.sqrt(getDistance2(headPos.x, headPos.y, bodyPart.xx, bodyPart.yy));
        if (bodyDistance < safeDistance) {
          const approachAngle = this.calculateApproachAngle(headPos, { x: bodyPart.xx, y: bodyPart.yy }, lookAheadVector);
          const dangerLevel = this.calculateDangerLevel(bodyDistance, safeDistance, approachAngle);

          this.dangerZones.push({
            point: { x: bodyPart.xx, y: bodyPart.yy },
            distance: bodyDistance,
            radius: safeDistance,
            approachAngle: approachAngle,
            dangerLevel: dangerLevel,
            type: 'snake_body', // Mark as body part for orange dot visualization
            bodyIndex: i
          });
        }
      }
    }

    // Helper method to get snake width (copied from bot)
    getSnakeWidth(sc) {
      return Math.round(sc * 29);
    }

    // Check collision with game borders
    checkBorderCollision(headPos, lookAheadVector, snakeRadius, borderSize) {
      const safeDistance = snakeRadius + this.safetyMargin;

      // Check game boundary walls using actual game border logic
      if (window.grd) {
        const borderDist = window.grd - safeDistance;
        const distanceToCenter = Math.sqrt(getDistance2(headPos.x, headPos.y, window.grd, window.grd));

        if (distanceToCenter > borderDist) {
          // Near border - create danger zone
          const borderAngle = fastAtan2(window.grd - headPos.y, window.grd - headPos.x);
          const borderPoint = {
            x: window.grd + Math.cos(borderAngle) * window.grd,
            y: window.grd + Math.sin(borderAngle) * window.grd
          };

          const distance = Math.sqrt(getDistance2(headPos.x, headPos.y, borderPoint.x, borderPoint.y));
          const approachAngle = this.calculateApproachAngle(headPos, borderPoint, lookAheadVector);
          const dangerLevel = this.calculateDangerLevel(distance, safeDistance, approachAngle);

          this.dangerZones.push({
            point: borderPoint,
            distance: distance,
            radius: safeDistance,
            approachAngle: approachAngle,
            dangerLevel: dangerLevel,
            type: 'border'
          });
        }
      }
    }

    // Calculate approach angle between current heading and obstacle
    calculateApproachAngle(headPos, obstaclePos, lookAheadVector) {
      const obstacleAngle = fastAtan2(obstaclePos.y - headPos.y, obstaclePos.x - headPos.x);
      const headingAngle = fastAtan2(lookAheadVector.y, lookAheadVector.x);

      let diff = Math.abs(obstacleAngle - headingAngle);
      if (diff > Math.PI) diff = 2 * Math.PI - diff;

      return diff;
    }

    // Calculate danger level based on distance and approach angle
    calculateDangerLevel(distance, safeDistance, approachAngle) {
      const distanceFactor = Math.max(0, (safeDistance - distance) / safeDistance);
      const angleFactor = Math.max(0, (Math.PI - approachAngle) / Math.PI);

      return Math.min(1, distanceFactor * angleFactor * 2);
    }

    // Calculate avoidance for full control mode (like bot mode)
    calculateFullControlAvoidance(headPos, headAngle, snakeRadius) {
      if (this.dangerZones.length === 0) {
        this.controlActive = false;
        this.lastControlAngle = 0;
        return null; // No danger, user has full control
      }

      this.controlActive = true;

      // Sort danger zones by danger level
      this.dangerZones.sort((a, b) => b.dangerLevel - a.dangerLevel);

      // Check for critical collision (very close)
      const criticalDanger = this.dangerZones.find(d => d.distance < snakeRadius + 40);
      if (criticalDanger) {
        // Emergency steering - take full control immediately
        const emergencyAngle = this.calculateEmergencyDirection(headPos, headAngle, criticalDanger);
        this.lastControlAngle = emergencyAngle;
        console.log(`EMERGENCY CONTROL: ${(emergencyAngle * 180 / Math.PI).toFixed(1)}°`);
        return emergencyAngle;
      }

      // Calculate optimal avoidance direction
      const optimalDirection = this.calculateOptimalDirection(headPos, headAngle, snakeRadius);
      
      // Apply smoothing to direction changes
      if (this.lastControlAngle !== 0) {
        const angleDiff = this.angleDifference(optimalDirection, this.lastControlAngle);
        this.lastControlAngle += angleDiff * this.controlSmoothingFactor;
      } else {
        this.lastControlAngle = optimalDirection;
      }

      return this.lastControlAngle;
    }

    // Calculate emergency direction for critical situations
    calculateEmergencyDirection(headPos, headAngle, criticalDanger) {
      const obstacleAngle = fastAtan2(criticalDanger.point.y - headPos.y, criticalDanger.point.x - headPos.x);

      // Calculate perpendicular escape directions
      const leftEscape = obstacleAngle + Math.PI / 2;
      const rightEscape = obstacleAngle - Math.PI / 2;

      // Choose the escape route that requires less turning from current heading
      const leftDiff = Math.abs(this.angleDifference(leftEscape, headAngle));
      const rightDiff = Math.abs(this.angleDifference(rightEscape, headAngle));

      return leftDiff < rightDiff ? leftEscape : rightEscape;
    }

    // Calculate optimal direction considering all dangers
    calculateOptimalDirection(headPos, headAngle, snakeRadius) {
      let totalAvoidanceX = 0;
      let totalAvoidanceY = 0;
      let totalWeight = 0;

      for (const danger of this.dangerZones) {
        const weight = danger.dangerLevel;
        const avoidanceDirection = this.calculateSingleDangerAvoidance(headPos, headAngle, danger);

        totalAvoidanceX += Math.cos(avoidanceDirection) * weight;
        totalAvoidanceY += Math.sin(avoidanceDirection) * weight;
        totalWeight += weight;
      }

      if (totalWeight === 0) return headAngle;

      // Calculate weighted average direction
      const optimalDirection = fastAtan2(totalAvoidanceY, totalAvoidanceX);
      
      // Limit maximum turning angle for smoother movement
      const maxTurn = Math.PI / 3; // 60 degrees max turn
      let turnAmount = this.angleDifference(optimalDirection, headAngle);
      turnAmount = Math.max(-maxTurn, Math.min(maxTurn, turnAmount));
      
      return headAngle + turnAmount;
    }

    // Calculate avoidance direction for a single danger
    calculateSingleDangerAvoidance(headPos, headAngle, danger) {
      const obstacleAngle = fastAtan2(danger.point.y - headPos.y, danger.point.x - headPos.x);

      // Calculate the angle to steer AWAY from the obstacle
      const avoidanceAngle = obstacleAngle + Math.PI; // Point away from obstacle

      // For head-on approaches, steer perpendicular to obstacle
      if (danger.approachAngle < Math.PI / 4) { // < 45 degrees approach
        const leftAngle = avoidanceAngle + Math.PI / 2;
        const rightAngle = avoidanceAngle - Math.PI / 2;

        // Choose the direction that requires less turning
        const leftDiff = Math.abs(this.angleDifference(leftAngle, headAngle));
        const rightDiff = Math.abs(this.angleDifference(rightAngle, headAngle));

        return leftDiff < rightDiff ? leftAngle : rightAngle;
      } else {
        // For angled approaches, steer away smoothly
        return avoidanceAngle;
      }
    }

    // Check if point is to the left of the line
    isLeft(lineStart, lineEnd, point) {
      return ((lineEnd.x - lineStart.x) * (point.y - lineStart.y) -
              (lineEnd.y - lineStart.y) * (point.x - lineStart.x)) > 0;
    }

    // Calculate angle difference (-π to π)
    angleDifference(angle1, angle2) {
      let diff = angle1 - angle2;
      while (diff > Math.PI) diff -= 2 * Math.PI;
      while (diff < -Math.PI) diff += 2 * Math.PI;
      return diff;
    }



    // Draw debug visuals
    drawDebugVisuals(headPos, headAngle, snakeRadius) {
      const lookAheadPoint = {
        x: headPos.x + Math.cos(headAngle) * this.lookaheadDistance,
        y: headPos.y + Math.sin(headAngle) * this.lookaheadDistance
      };

      // Draw lookahead line
      this.visualizer.drawLine(headPos, lookAheadPoint, "cyan", 2);

      // Draw danger zones
      for (const danger of this.dangerZones) {
        if (danger.type === 'snake_body') {
          // Draw orange dots on dangerous snake body parts instead of red lines
          this.visualizer.drawCircle(
            { x: danger.point.x, y: danger.point.y, r: 8 },
            "orange",
            true, // filled
            danger.dangerLevel
          );
        } else {
          const color = danger.type === 'snake' || danger.type === 'moving_snake' ? 'red' : 'orange';
          const alpha = danger.dangerLevel;

          this.visualizer.drawCircle(
            { x: danger.point.x, y: danger.point.y, r: danger.radius },
            color,
            false,
            alpha
          );
        }
      }

      // Draw current control direction (if in full control mode)
      if (this.controlActive && this.lastControlAngle !== 0) {
        const controlPoint = {
          x: headPos.x + Math.cos(this.lastControlAngle) * 150,
          y: headPos.y + Math.sin(this.lastControlAngle) * 150
        };
        this.visualizer.drawLine(headPos, controlPoint, "lime", 4);
        
        // Draw control indicator
        this.visualizer.drawCircle(
          { x: controlPoint.x, y: controlPoint.y, r: 10 },
          "lime",
          true,
          0.8
        );
      }
    }



    // Toggle collision avoidance
    toggle() {
      this.enabled = !this.enabled;
    }

    // Toggle visual debugging
    toggleVisuals() {
      this.visualsEnabled = !this.visualsEnabled;
    }
  };

  // src/bot/bot.ts
  var visualizer = new Visualizer();
  var collisionAvoidance = new CollisionAvoidance(visualizer);
  var Bot = class {
    stage = "grow";
    collisionPoints = [];
    collisionAngles = [];
    foodAngles = [];
    defaultAccel = 0;
    currentFood;
    opt = {
      // target fps
      targetFps: 60,
      // size of arc for collisionAngles
      arcSize: Math.PI / 8,
      // radius multiple for circle intersects
      radiusMult: 10,
      // food cluster size to trigger acceleration
      foodAccelSz: 200,
      // maximum angle of food to trigger acceleration
      foodAccelDa: Math.PI / 2,
      // how many frames per action
      actionFrames: 2,
      // how many frames to delay action after collision
      collisionDelay: 10,
      // base speed
      speedBase: 5.78,
      // front angle size
      frontAngle: Math.PI / 2,
      // percent of angles covered by same snake to be considered an encircle attempt
      enCircleThreshold: 0.5625,
      // percent of angles covered by all snakes to move to safety
      enCircleAllThreshold: 0.5625,
      // distance multiplier for enCircleAllThreshold
      enCircleDistanceMult: 20,
      // snake score to start circling on self
      followCircleLength: 2e3,
      // direction for followCircle: +1 for counter clockwise and -1 for clockwise
      followCircleDirection: 1
    };
    MAXARC = 0;
    #enableEncircle = true;
    #enbaleFollowCircle = true;
    #borderPointRadius = 20;
    #goalCoordinates = { x: 0, y: 0 };
    #headCircle = { x: 0, y: 0, r: 0 };
    #sideCircleL = { x: 0, y: 0, r: 0 };
    #sideCircleR = { x: 0, y: 0, r: 0 };
    #id = 0;
    #pts = [];
    #x = 0;
    #y = 0;
    #ang = 0;
    #cos = 0;
    #sin = 0;
    #speedMult = 1;
    #width = 0;
    #radius = 0;
    #snakeLength = 0;
    #bodyPoints = [];
    #len = 0;
    #delayFrame = 0;
    onSetCoordinates = (x, y) => {
    };
    onAcceleration = (accel) => {
    };
    visualizeEnabled(enabled) {
      visualizer.enabled = enabled;
    }
    getSnakeLength(sk) {
      if (null == sk || 0 > sk.sct || 0 > sk.fam || 0 > sk.rsc) {
        return 0;
      }
      const sct = sk.sct + sk.rsc;
      return Math.trunc(
        15 * (window.fpsls[sct] + sk.fam / window.fmlts[sct] - 1) - 5
      );
    }
    getSnakeWidth(sc) {
      return Math.round(sc * 29);
    }
    // Check if circles intersect
    circleIntersect(circle1, circle2) {
      const bothRadii = circle1.r + circle2.r;
      if (circle1.x + bothRadii > circle2.x && circle1.y + bothRadii > circle2.y && circle1.x < circle2.x + bothRadii && circle1.y < circle2.y + bothRadii) {
        const distance2 = getDistance2(
          circle1.x,
          circle1.y,
          circle2.x,
          circle2.y
        );
        if (distance2 < bothRadii * bothRadii) {
          const x = (circle1.x * circle2.r + circle2.x * circle1.r) / bothRadii;
          const y = (circle1.y * circle2.r + circle2.y * circle1.r) / bothRadii;
          const a = fastAtan2(y - this.#y, x - this.#x);
          const point = { x, y, a };
          return point;
        }
      }
      return void 0;
    }
    // angleBetween - get the smallest angle between two angles (0-pi)
    angleBetween(a1, a2) {
      const r1 = (a1 - a2) % Math.PI;
      const r2 = (a2 - a1) % Math.PI;
      return r1 < r2 ? -r1 : r2;
    }
    // Change heading to ang
    changeHeadingAbs(angle) {
      const cos = Math.cos(angle);
      const sin = Math.sin(angle);
      return {
        x: Math.round(this.#x + 500 * cos),
        y: Math.round(this.#y + 500 * sin)
      };
    }
    // Change heading by ang
    // +0-pi turn left
    // -0-pi turn right
    changeHeadingRel(angle) {
      const heading = {
        x: this.#x + 500 * this.#cos,
        y: this.#y + 500 * this.#sin
      };
      const cos = Math.cos(-angle);
      const sin = Math.sin(-angle);
      return {
        x: Math.round(
          cos * (heading.x - this.#x) - sin * (heading.y - this.#y) + this.#x
        ),
        y: Math.round(
          sin * (heading.x - this.#x) + cos * (heading.y - this.#y) + this.#y
        )
      };
    }
    // Change heading to the best angle for avoidance.
    headingBestAngle() {
      const openAngles = [];
      let best;
      let distance;
      let openStart;
      let sIndex = this.getAngleIndex(this.#ang) + this.MAXARC / 2;
      if (sIndex > this.MAXARC) sIndex -= this.MAXARC;
      for (let i = 0; i < this.MAXARC; i++) {
        const ao = this.collisionAngles[i];
        if (ao === void 0) {
          distance = 0;
          if (openStart === void 0) {
            openStart = i;
          }
        } else {
          distance = ao.d2;
          if (openStart) {
            openAngles.push({
              openStart,
              openEnd: i - 1,
              sz: i - 1 - openStart
            });
            openStart = void 0;
          }
        }
        if (best === void 0 || best.distance < distance && best.distance !== 0) {
          best = {
            distance,
            aIndex: i
          };
        }
      }
      if (openStart && openAngles[0]) {
        openAngles[0].openStart = openStart;
        openAngles[0].sz = openAngles[0].openEnd - openStart;
        if (openAngles[0].sz < 0) openAngles[0].sz += this.MAXARC;
      } else if (openStart) {
        openAngles.push({ openStart, openEnd: openStart, sz: 0 });
      }
      if (openAngles.length > 0) {
        openAngles.sort(this.sortSz);
        this.#goalCoordinates = this.changeHeadingAbs(
          (openAngles[0].openEnd - openAngles[0].sz / 2) * this.opt.arcSize
        );
      } else if (best) {
        this.#goalCoordinates = this.changeHeadingAbs(
          best.aIndex * this.opt.arcSize
        );
      }
    }
    // Avoid collision point by ang
    // ang radians <= Math.PI (180deg)
    avoidCollisionPoint(point, angle) {
      const ang = angle === void 0 || angle > Math.PI ? Math.PI : angle;
      const head = {
        x: this.#x,
        y: this.#y
      };
      const end = {
        x: this.#x + 2e3 * this.#cos,
        y: this.#y + 2e3 * this.#sin
      };
      const left = isLeft(head, end, point);
      visualizer.drawLine(head, end, "orange");
      visualizer.drawLine(head, point, "red");
      this.#goalCoordinates = this.changeHeadingAbs(
        left ? point.a - ang : point.a + ang
      );
    }
    // get collision angle index, expects angle +/i 0 to Math.PI
    getAngleIndex(angle) {
      let ang = angle;
      if (angle < 0) {
        ang += 2 * Math.PI;
      }
      const index = Math.round(ang * (1 / this.opt.arcSize));
      return index === this.MAXARC ? 0 : index;
    }
    // Add to collisionAngles if distance is closer
    addCollisionAngle(sp) {
      const ang = fastAtan2(
        Math.round(sp.y - this.#y),
        Math.round(sp.x - this.#x)
      );
      const aIndex = this.getAngleIndex(ang);
      const actualDistance = Math.round((Math.sqrt(sp.d2) - sp.r) ** 2);
      if (this.collisionAngles[aIndex] === void 0 || this.collisionAngles[aIndex].d2 > sp.d2) {
        this.collisionAngles[aIndex] = {
          x: Math.round(sp.x),
          y: Math.round(sp.y),
          ang,
          si: sp.si,
          d2: actualDistance,
          r: sp.r,
          aIndex
        };
      }
    }
    // Add and score foodAngles
    addFoodAngle(f) {
      const ang = fastAtan2(Math.round(f.y - this.#y), Math.round(f.x - this.#x));
      const aIndex = this.getAngleIndex(ang);
      if (this.collisionAngles[aIndex] === void 0 || Math.sqrt(this.collisionAngles[aIndex].d2) > Math.sqrt(f.d2) + this.#radius * this.opt.radiusMult * this.#speedMult / 2) {
        const fa = this.foodAngles[aIndex];
        if (fa === void 0) {
          this.foodAngles[aIndex] = {
            x: Math.round(f.x),
            y: Math.round(f.y),
            ang,
            da: Math.abs(this.angleBetween(ang, this.#ang)),
            d2: f.d2,
            sz: f.sz,
            score: f.sz ** 2 / f.d2
          };
        } else {
          fa.sz += Math.round(f.sz);
          fa.score += f.sz ** 2 / f.d2;
          if (fa.d2 > f.d2) {
            fa.x = Math.round(f.x);
            fa.y = Math.round(f.y);
            fa.d2 = f.d2;
          }
        }
      }
    }
    // Get closest collision point per snake.
    getCollisionPoints() {
      this.collisionPoints = [];
      this.collisionAngles = [];
      const farCollisionD2 = (this.#width * 50) ** 2;
      for (let i = 0, ls = window.slithers.length; i < ls; i++) {
        if (window.slithers[i].id === this.#id) continue;
        const s = window.slithers[i];
        const sRadius = this.getSnakeWidth(s.sc) / 2;
        const sSpMult = Math.min(1, s.sp / 5.78 - 1);
        const sRadiusMult = sRadius * sSpMult * this.opt.radiusMult;
        const x = s.xx + Math.cos(s.ang) * sRadiusMult / 2;
        const y = s.yy + Math.sin(s.ang) * sRadiusMult / 2;
        const d2 = getDistance2(this.#x, this.#y, x, y);
        const scPoint = {
          x,
          y,
          r: this.#headCircle.r,
          d2,
          si: i,
          type: 0,
          speed: s.sp
        };
        this.addCollisionAngle(scPoint);
        this.collisionPoints.push(scPoint);
        visualizer.drawCircle(scPoint, "red");
        const pts = s.pts;
        for (let j = 0, lp = pts.length; j < lp; j++) {
          const po = pts[j];
          if (po == null || po.dying) continue;
          const pd2 = getDistance2(this.#x, this.#y, po.xx, po.yy);
          if (pd2 > farCollisionD2) continue;
          const collisionPoint = {
            x: po.xx,
            y: po.yy,
            r: sRadius,
            d2: pd2,
            si: i,
            type: 1
          };
          this.addCollisionAngle(collisionPoint);
          if (collisionPoint.d2 <= (this.#headCircle.r + collisionPoint.r) ** 2) {
            this.collisionPoints.push(collisionPoint);
          }
        }
      }
      const intoViewWall = Math.abs(window.flux_grd - window.view_dist) < 1e3;
      if (intoViewWall) {
        const borderDist = window.flux_grd + this.#borderPointRadius;
        const borderPointWidth = this.#borderPointRadius * 2;
        for (let j = 3, i = -j; i <= j; i++) {
          const wa = window.view_ang + i * borderPointWidth / window.flux_grd;
          const wx = window.grd + borderDist * Math.cos(wa);
          const wy = window.grd + borderDist * Math.sin(wa);
          const wd2 = getDistance2(this.#x, this.#y, wx, wy);
          const wallPoint = {
            x: wx,
            y: wy,
            r: this.#borderPointRadius,
            d2: wd2,
            si: -1,
            type: 2
          };
          this.collisionPoints.push(wallPoint);
          this.addCollisionAngle(wallPoint);
          visualizer.drawCircle(wallPoint, "yellow");
        }
      }
      this.collisionPoints.sort(this.sortDistance);
    }
    // Is collisionPoint (xx) in frontAngle
    inFrontAngle(point) {
      const ang = fastAtan2(
        Math.round(point.y - this.#y),
        Math.round(point.x - this.#x)
      );
      return Math.abs(this.angleBetween(ang, this.#ang)) < this.opt.frontAngle;
    }
    // Checks to see if you are going to collide with anything in the collision detection radius
    checkCollision() {
      this.getCollisionPoints();
      if (this.collisionPoints.length === 0) return false;
      for (let i = 0; i < this.collisionPoints.length; i++) {
        const cp = this.collisionPoints[i];
        const collisionCircle = {
          x: cp.x,
          y: cp.y,
          r: cp.r
        };
        const intersectPoint = this.circleIntersect(
          this.#headCircle,
          collisionCircle
        );
        if (intersectPoint && this.inFrontAngle(intersectPoint)) {
          if (cp.type === 0 && window.slithers[cp.si].sp > 10) {
            this.onAcceleration(1);
          } else {
            this.onAcceleration(this.defaultAccel);
          }
          this.avoidCollisionPoint(intersectPoint);
          return true;
        }
      }
      this.onAcceleration(this.defaultAccel);
      return false;
    }
    checkEncircle() {
      if (!this.#enableEncircle) return false;
      const enSnake = [];
      let high = 0;
      let highSnake = 0;
      let enAll = 0;
      for (let i = 0; i < this.collisionAngles.length; i++) {
        const ca = this.collisionAngles[i];
        if (ca !== void 0) {
          const si = ca.si;
          if (enSnake[si]) {
            enSnake[si]++;
          } else {
            enSnake[si] = 1;
          }
          if (enSnake[si] > high) {
            high = enSnake[si];
            highSnake = si;
          }
          if (ca.d2 < (this.#radius * this.opt.enCircleDistanceMult) ** 2) {
            enAll++;
          }
        }
      }
      if (high > this.MAXARC * this.opt.enCircleThreshold) {
        this.headingBestAngle();
        if (high !== this.MAXARC && window.slithers[highSnake].sp > 10) {
          this.onAcceleration(1);
        } else {
          this.onAcceleration(this.defaultAccel);
        }
        visualizer.drawCircle(
          {
            x: this.#x,
            y: this.#y,
            r: this.opt.radiusMult * this.#radius
          },
          "red",
          true,
          0.2
        );
        return true;
      }
      if (enAll > this.MAXARC * this.opt.enCircleAllThreshold) {
        this.headingBestAngle();
        this.onAcceleration(this.defaultAccel);
        visualizer.drawCircle(
          {
            x: this.#x,
            y: this.#y,
            r: this.opt.radiusMult * this.opt.enCircleDistanceMult
          },
          "yellow",
          true,
          0.2
        );
        return true;
      }
      this.onAcceleration(this.defaultAccel);
      visualizer.drawCircle(
        {
          x: this.#x,
          y: this.#y,
          r: this.opt.radiusMult * this.opt.enCircleDistanceMult
        },
        "yellow"
      );
      return false;
    }
    populatePts() {
      let x = this.#x;
      let y = this.#y;
      let l = 0;
      this.#bodyPoints = [{ x, y, len: l }];
      const pts = this.#pts;
      for (let p = pts.length - 1; p >= 0; p--) {
        const po = pts[p];
        if (po.dying) {
          continue;
        }
        const xx = po.xx;
        const yy = po.yy;
        const ll = l + Math.sqrt(getDistance2(x, y, xx, yy));
        this.#bodyPoints.push({ x: xx, y: yy, len: ll });
        x = xx;
        y = yy;
        l = ll;
      }
      this.#len = l;
    }
    // set the direction of rotation based on the velocity of
    // the head with respect to the center of mass
    determineCircleDirection() {
      let cx = 0;
      let cy = 0;
      const bodyPoints = this.#bodyPoints;
      const pn = bodyPoints.length;
      for (let p = 0; p < pn; p++) {
        cx += bodyPoints[p].x;
        cy += bodyPoints[p].y;
      }
      cx /= pn;
      cy /= pn;
      const dx = this.#x - cx;
      const dy = this.#y - cy;
      if (-dy * this.#cos + dx * this.#sin > 0) {
        this.opt.followCircleDirection = -1;
      } else {
        this.opt.followCircleDirection = 1;
      }
    }
    // returns a point on snake's body on given length from the head
    // assumes that this.pts is populated
    smoothPoint(t) {
      const bodyPoints = this.#bodyPoints;
      if (t >= this.#len) {
        const tail = bodyPoints[bodyPoints.length - 1];
        return {
          x: tail.x,
          y: tail.y
        };
      }
      if (t <= 0) {
        return {
          x: bodyPoints[0].x,
          y: bodyPoints[0].y
        };
      }
      let p = 0;
      let q = bodyPoints.length - 1;
      while (q - p > 1) {
        const m = Math.round((p + q) / 2);
        if (t > bodyPoints[m].len) {
          p = m;
        } else {
          q = m;
        }
      }
      const wp = bodyPoints[q].len - t;
      const wq = t - bodyPoints[p].len;
      const w = wp + wq;
      return {
        x: (wp * bodyPoints[p].x + wq * bodyPoints[q].x) / w,
        y: (wp * bodyPoints[p].y + wq * bodyPoints[q].y) / w
      };
    }
    // finds a point on snake's body closest to the head;
    // returns length from the head
    // excludes points close to the head
    closestBodyPoint() {
      const bodyPoints = this.#bodyPoints;
      const ptsLength = bodyPoints.length;
      let start_n = 0;
      let start_d2 = 0;
      for (; ; ) {
        const prev_d2 = start_d2;
        start_n++;
        start_d2 = getDistance2(
          this.#x,
          this.#y,
          bodyPoints[start_n].x,
          bodyPoints[start_n].y
        );
        if (start_d2 < prev_d2 || start_n === ptsLength - 1) {
          break;
        }
      }
      if (start_n >= ptsLength || start_n <= 1) {
        return this.#len;
      }
      let min_n = start_n;
      let min_d2 = start_d2;
      for (let n = min_n + 1; n < ptsLength; n++) {
        const d2 = getDistance2(
          this.#x,
          this.#y,
          bodyPoints[n].x,
          bodyPoints[n].y
        );
        if (d2 < min_d2) {
          min_n = n;
          min_d2 = d2;
        }
      }
      let next_n = min_n;
      let next_d2 = min_d2;
      if (min_n === ptsLength - 1) {
        next_n = min_n - 1;
        next_d2 = getDistance2(
          this.#x,
          this.#y,
          bodyPoints[next_n].x,
          bodyPoints[next_n].y
        );
      } else {
        const d2m = getDistance2(
          this.#x,
          this.#y,
          bodyPoints[min_n - 1].x,
          bodyPoints[min_n - 1].y
        );
        const d2p = getDistance2(
          this.#x,
          this.#y,
          bodyPoints[min_n + 1].x,
          bodyPoints[min_n + 1].y
        );
        if (d2m < d2p) {
          next_n = min_n - 1;
          next_d2 = d2m;
        } else {
          next_n = min_n + 1;
          next_d2 = d2p;
        }
      }
      let t2 = bodyPoints[min_n].len - bodyPoints[next_n].len;
      t2 *= t2;
      if (t2 === 0) {
        return bodyPoints[min_n].len;
      }
      const min_w = t2 - (min_d2 - next_d2);
      const next_w = t2 + (min_d2 - next_d2);
      return (bodyPoints[min_n].len * min_w + bodyPoints[next_n].len * next_w) / (2 * t2);
    }
    bodyDangerZone(offset, targetPoint, targetPointNormal, closePointDist, pastTargetPoint, closePoint) {
      const o = this.opt.followCircleDirection;
      const pts = [
        {
          x: this.#x - o * offset * this.#sin,
          y: this.#y + o * offset * this.#cos
        },
        {
          x: this.#x + this.#width * this.#cos + offset * (this.#cos - o * this.#sin),
          y: this.#y + this.#width * this.#sin + offset * (this.#sin + o * this.#cos)
        },
        {
          x: this.#x + 1.75 * this.#width * this.#cos + o * 0.3 * this.#width * this.#sin + offset * (this.#cos - o * this.#sin),
          y: this.#y + 1.75 * this.#width * this.#sin - o * 0.3 * this.#width * this.#cos + offset * (this.#sin + o * this.#cos)
        },
        {
          x: this.#x + 2.5 * this.#width * this.#cos + o * 0.7 * this.#width * this.#sin + offset * (this.#cos - o * this.#sin),
          y: this.#y + 2.5 * this.#width * this.#sin - o * 0.7 * this.#width * this.#cos + offset * (this.#sin + o * this.#cos)
        },
        {
          x: this.#x + 3 * this.#width * this.#cos + o * 1.2 * this.#width * this.#sin + offset * this.#cos,
          y: this.#y + 3 * this.#width * this.#sin - o * 1.2 * this.#width * this.#cos + offset * this.#sin
        },
        {
          x: targetPoint.x + targetPointNormal.x * (offset + 0.5 * Math.max(closePointDist, 0)),
          y: targetPoint.y + targetPointNormal.y * (offset + 0.5 * Math.max(closePointDist, 0))
        },
        {
          x: pastTargetPoint.x + targetPointNormal.x * offset,
          y: pastTargetPoint.y + targetPointNormal.y * offset
        },
        pastTargetPoint,
        targetPoint,
        closePoint
      ];
      return addPolyBox({
        pts: convexHull(pts)
      });
    }
    constructInsidePolygon(closePointT) {
      const insidePolygonStartT = 5 * this.#width;
      const insidePolygonEndT = closePointT + 5 * this.#width;
      const insidePolygonPts = [
        this.smoothPoint(insidePolygonEndT),
        this.smoothPoint(insidePolygonStartT)
      ];
      for (let t = insidePolygonStartT; t < insidePolygonEndT; t += this.#width) {
        insidePolygonPts.push(this.smoothPoint(t));
      }
      const insidePolygon = addPolyBox({
        pts: insidePolygonPts
      });
      return insidePolygon;
    }
    followCircleSelf() {
      this.populatePts();
      this.determineCircleDirection();
      const o = this.opt.followCircleDirection;
      if (this.#len < 9 * this.#width) {
        return;
      }
      const closePointT = this.closestBodyPoint();
      const closePoint = this.smoothPoint(closePointT);
      const closePointNext = this.smoothPoint(closePointT - this.#width);
      const closePointTangent = unitVector({
        x: closePointNext.x - closePoint.x,
        y: closePointNext.y - closePoint.y
      });
      const closePointNormal = {
        x: -o * closePointTangent.y,
        y: o * closePointTangent.x
      };
      const currentCourse = Math.asin(
        Math.max(
          -1,
          Math.min(
            1,
            this.#cos * closePointNormal.x + this.#sin * closePointNormal.y
          )
        )
      );
      const closePointDist = (this.#x - closePoint.x) * closePointNormal.x + (this.#y - closePoint.y) * closePointNormal.y;
      const insidePolygon = this.constructInsidePolygon(closePointT);
      let targetPointT = closePointT;
      let targetPointFar = 0;
      const targetPointStep = this.#width / 64;
      for (let h = closePointDist, a = currentCourse; h >= 0.125 * this.#width; ) {
        targetPointT -= targetPointStep;
        targetPointFar += targetPointStep * Math.cos(a);
        h += targetPointStep * Math.sin(a);
        a = Math.max(-Math.PI / 4, a - targetPointStep / this.#width);
      }
      const targetPoint = this.smoothPoint(targetPointT);
      const pastTargetPointT = targetPointT - 3 * this.#width;
      const pastTargetPoint = this.smoothPoint(pastTargetPointT);
      const offsetIncrement = 0.0625 * this.#width;
      let enemyBodyOffsetDelta = 0.25 * this.#width;
      let enemyHeadDist2 = 64 * 64 * this.#width * this.#width;
      for (let i = 0, snakesNum = window.slithers.length; i < snakesNum; i++) {
        const sk = window.slithers[i];
        if (sk.id === this.#id) continue;
        const enemyWidth = this.getSnakeWidth(sk.sc);
        const enemyHead = {
          x: sk.xx,
          y: sk.yy
        };
        const enemyAhead = {
          x: enemyHead.x + Math.cos(sk.ang) * this.#width,
          y: enemyHead.y + Math.sin(sk.ang) * this.#width
        };
        if (!pointInPoly(enemyHead, insidePolygon)) {
          enemyHeadDist2 = Math.min(
            enemyHeadDist2,
            getDistance2(enemyHead.x, enemyHead.y, targetPoint.x, targetPoint.y),
            getDistance2(
              enemyAhead.x,
              enemyAhead.y,
              targetPoint.x,
              targetPoint.y
            )
          );
        }
        let offsetSet = false;
        let offset = 0;
        let cpolbody = {
          pts: [],
          minx: 0,
          miny: 0,
          maxx: 0,
          maxy: 0
        };
        const bodyOffset = 0.5 * (this.#width + enemyWidth);
        const pts = sk.pts;
        for (let j = 0, ptsNum = pts.length; j < ptsNum; j++) {
          const po = pts[j];
          if (po == null || po.dying) continue;
          const point = {
            x: po.xx,
            y: po.yy
          };
          while (!offsetSet || enemyBodyOffsetDelta >= -this.#width && pointInPoly(point, cpolbody)) {
            if (!offsetSet) {
              offsetSet = true;
            } else {
              enemyBodyOffsetDelta -= offsetIncrement;
            }
            offset = bodyOffset + enemyBodyOffsetDelta;
            cpolbody = this.bodyDangerZone(
              offset,
              targetPoint,
              closePointNormal,
              closePointDist,
              pastTargetPoint,
              closePoint
            );
          }
        }
      }
      const intoViewWall = Math.abs(window.flux_grd - window.view_dist) < 1e3;
      let wallOffsetDelta = 0;
      if (intoViewWall) {
        const borderPointWidth = this.#borderPointRadius * 2;
        const radius = window.flux_grd + this.#borderPointRadius;
        const wallOffset = 0.5 * (this.#width + this.#borderPointRadius);
        let offsetSet = false;
        let offset = 0;
        let cpolbody = {
          pts: [],
          minx: 0,
          miny: 0,
          maxx: 0,
          maxy: 0
        };
        for (let j = 2, i = -j; i <= j; i++) {
          const wa = window.view_ang + i * borderPointWidth / window.flux_grd;
          const wx = window.grd + radius * Math.cos(wa);
          const wy = window.grd + radius * Math.sin(wa);
          const wallPoint = {
            x: wx,
            y: wy
          };
          while (!offsetSet || wallOffsetDelta >= -this.#width && pointInPoly(wallPoint, cpolbody)) {
            if (!offsetSet) {
              offsetSet = true;
            } else {
              wallOffsetDelta -= offsetIncrement;
            }
            offset = wallOffset + wallOffsetDelta;
            cpolbody = this.bodyDangerZone(
              offset,
              targetPoint,
              closePointNormal,
              closePointDist,
              pastTargetPoint,
              closePoint
            );
          }
        }
      }
      const enemyHeadDist = Math.sqrt(enemyHeadDist2);
      {
        for (let i = 0, points = insidePolygon.pts, l = points.length; i < l; i++) {
          visualizer.drawLine(points[i], points[(i + 1) % l], "orange");
        }
        visualizer.drawCircle(
          {
            x: closePoint.x,
            y: closePoint.y,
            r: this.#width * 0.25
          },
          "green"
        );
        visualizer.drawCircle(
          {
            x: targetPoint.x,
            y: targetPoint.y,
            r: this.#width + 2 * targetPointFar
          },
          "blue"
        );
        visualizer.drawCircle(
          {
            x: targetPoint.x,
            y: targetPoint.y,
            r: this.#width * 0.2
          },
          "blue"
        );
        const soffset = 0.5 * this.#width;
        const scpolbody = this.bodyDangerZone(
          soffset,
          targetPoint,
          closePointNormal,
          closePointDist,
          pastTargetPoint,
          closePoint
        );
        for (let i = 0, points = scpolbody.pts, l = points.length; i < l; i++) {
          visualizer.drawLine(points[i], points[(i + 1) % l], "white");
        }
      }
      let targetCourse = currentCourse + 0.25;
      let headProx = -1 - (2 * targetPointFar - enemyHeadDist) / this.#width;
      if (headProx > 0) {
        headProx = 0.125 * headProx * headProx;
      } else {
        headProx = -0.5 * headProx * headProx;
      }
      targetCourse = Math.min(targetCourse, headProx);
      const adjustedBodyOffset = (enemyBodyOffsetDelta - 0.0625 * this.#width) / this.#width;
      targetCourse = Math.min(targetCourse, targetCourse + adjustedBodyOffset);
      const adjustedWallOffset = (wallOffsetDelta - 0.0625 * this.#width) / this.#width;
      if (intoViewWall) {
        targetCourse = Math.min(targetCourse, targetCourse + adjustedWallOffset);
      }
      const tailBehind = this.#len - closePointT;
      const targetDir = unitVector({
        x: 0,
        y: 0
      });
      const driftQ = targetDir.x * closePointNormal.x + targetDir.y * closePointNormal.y;
      const allowTail = this.#width * (2 - 0.5 * driftQ);
      targetCourse = Math.min(
        targetCourse,
        (tailBehind - allowTail + (this.#width - closePointDist)) / this.#width
      );
      targetCourse = Math.min(
        targetCourse,
        -0.5 * (closePointDist - 4 * this.#width) / this.#width
      );
      targetCourse = Math.max(
        targetCourse,
        -0.75 * closePointDist / this.#width
      );
      targetCourse = Math.min(targetCourse, 1);
      const goalDir = {
        x: closePointTangent.x * Math.cos(targetCourse) - o * closePointTangent.y * Math.sin(targetCourse),
        y: closePointTangent.y * Math.cos(targetCourse) + o * closePointTangent.x * Math.sin(targetCourse)
      };
      const goal = {
        x: this.#x + goalDir.x * 4 * this.#width,
        y: this.#y + goalDir.y * 4 * this.#width
      };
      if (Math.abs(goal.x - this.#goalCoordinates.x) < 1e3 && Math.abs(goal.y - this.#goalCoordinates.y) < 1e3) {
        this.#goalCoordinates = {
          x: Math.round(goal.x * 0.25 + this.#goalCoordinates.x * 0.75),
          y: Math.round(goal.y * 0.25 + this.#goalCoordinates.y * 0.75)
        };
      } else {
        this.#goalCoordinates = {
          x: Math.round(goal.x),
          y: Math.round(goal.y)
        };
      }
    }
    // Sorting by property 'score' descending
    sortScore(a, b) {
      if (a === void 0) return 1;
      if (b === void 0) return -1;
      return b.score - a.score;
    }
    // Sorting by property 'sz' descending
    sortSz(a, b) {
      return b.sz - a.sz;
    }
    // Sorting by property 'd2' ascending
    sortDistance(a, b) {
      return a.d2 - b.d2;
    }
    computeFoodGoal() {
      this.foodAngles = [];
      for (let i = 0; i < window.foods.length; i++) {
        const fo = window.foods[i];
        if (fo == null || fo.eaten) continue;
        const f = {
          x: fo.xx,
          y: fo.yy,
          r: 2,
          d2: getDistance2(this.#x, this.#y, fo.xx, fo.yy),
          sz: fo.sz
        };
        const isInside = this.circleIntersect(f, this.#sideCircleL) || this.circleIntersect(f, this.#sideCircleR);
        if (!isInside) {
          this.addFoodAngle(f);
        }
      }
      this.foodAngles.sort(this.sortScore);
      if (this.foodAngles[0] !== void 0 && this.foodAngles[0].sz > 0) {
        this.currentFood = this.foodAngles[0];
      } else {
        this.currentFood = void 0;
      }
    }
    toCircle() {
      if (!this.#enbaleFollowCircle) return;
      const pts = this.#pts;
      const radius = this.#radius;
      for (let i = 0, e = 0, l = pts.length; i < l; i++) {
        const po = pts[i];
        if (po == null || po.dying) continue;
        if (++e > 20) break;
        const tailCircle = {
          x: po.xx,
          y: po.yy,
          r: radius
        };
        visualizer.drawCircle(tailCircle, "blue");
        if (this.circleIntersect(this.#headCircle, tailCircle)) {
          this.stage = "circle";
          return;
        }
      }
      const o = this.opt.followCircleDirection;
      this.onAcceleration(this.defaultAccel);
      this.#goalCoordinates = this.changeHeadingRel(o * Math.PI / 32);
    }
    delayAction() {
      if (this.#delayFrame === -1) return;
      if (this.#delayFrame > 0) {
        this.#delayFrame--;
        return;
      }
      if (window.playing && window.slither != null) {
        if (this.stage === "grow") {
          this.computeFoodGoal();
          this.#goalCoordinates = this.currentFood ?? {
            x: window.grd,
            y: window.grd
          };
        } else if (this.stage === "tocircle") {
          this.toCircle();
        }
      }
      this.#delayFrame = -1;
    }
    every() {
      if (window.slither == null) return;
      this.#id = window.slither.id;
      this.#x = window.slither.xx;
      this.#y = window.slither.yy;
      this.#ang = window.slither.ang;
      this.#pts = window.slither.pts;
      this.#cos = Math.cos(this.#ang);
      this.#sin = Math.sin(this.#ang);
      this.#speedMult = window.slither.sp / this.opt.speedBase;
      this.#width = this.getSnakeWidth(window.slither.sc);
      this.#radius = this.#width / 2;
      this.#snakeLength = this.getSnakeLength(window.slither);
      this.MAXARC = 2 * Math.PI / this.opt.arcSize;
      const spFactor = Math.min(1, this.#speedMult - 1) * this.opt.radiusMult;
      this.#headCircle = {
        x: this.#x + this.#cos * spFactor / 2 * this.#radius,
        y: this.#y + this.#sin * spFactor / 2 * this.#radius,
        r: this.opt.radiusMult / 2 * this.#radius
      };
      this.#sideCircleR = {
        x: this.#x - (this.#y + this.#sin * this.#width - this.#y),
        y: this.#y + (this.#x + this.#cos * this.#width - this.#x),
        r: this.#width * this.#speedMult
      };
      this.#sideCircleL = {
        x: this.#x + (this.#y + this.#sin * this.#width - this.#y),
        y: this.#y - (this.#x + this.#cos * this.#width - this.#x),
        r: this.#width * this.#speedMult
      };
      visualizer.drawCircle(this.#headCircle, "red");
    }
    go() {
      const ctx = window.mc.getContext("2d");
      if (ctx) visualizer.setContext(ctx);
      this.every();



      if (this.#snakeLength < this.opt.followCircleLength) {
        this.stage = "grow";
      }
      if (this.currentFood !== void 0 && this.stage !== "grow") {
        this.currentFood = void 0;
      }
      if (this.stage === "circle") {
        this.onAcceleration(this.defaultAccel);
        this.followCircleSelf();
      } else if (this.checkCollision() || this.checkEncircle()) {
        if (this.#delayFrame !== -1) {
          this.#delayFrame = this.opt.collisionDelay;
        }
      } else {
        if (this.#snakeLength > this.opt.followCircleLength) {
          this.stage = "tocircle";
        }
        if (this.#delayFrame === -1) {
          this.#delayFrame = this.opt.actionFrames;
        }
        this.onAcceleration(this.defaultAccel);
      }
      this.delayAction();
      this.onSetCoordinates(this.#goalCoordinates.x, this.#goalCoordinates.y);
      visualizer.drawLine(
        {
          x: this.#x,
          y: this.#y
        },
        this.#goalCoordinates,
        "green"
      );
      visualizer.drawCircle(
        {
          x: this.#goalCoordinates.x,
          y: this.#goalCoordinates.y,
          r: 5
        },
        "red"
      );
    }
    destory() {
      this.#delayFrame = 0;
    }
  };

  // src/zoom.ts
  var Zoom = class {
    #MIN = 0.08;
    #MAX = 30;
    #desired_gsc = 0;
    adjust(dir) {
      const scale = this.#desired_gsc * 0.9 ** dir;
      this.#desired_gsc = Math.max(this.#MIN, Math.min(this.#MAX, scale));
    }
    get() {
      return this.#desired_gsc;
    }
    set(scale) {
      this.#desired_gsc = scale;
    }
  };

  // src/core.ts
  var zoom = new Zoom();
  var bot = new Bot();
  bot.onSetCoordinates = (x, y) => {
    window.xm = x - window.view_xx;
    window.ym = y - window.view_yy;
  };
  bot.onAcceleration = (accel) => {
    window.setAcceleration(accel);
  };

  // node_modules/vanjs-core/src/van.js
  var protoOf = Object.getPrototypeOf;
  var changedStates;
  var derivedStates;
  var curDeps;
  var curNewDerives;
  var alwaysConnectedDom = { isConnected: 1 };
  var gcCycleInMs = 1e3;
  var statesToGc;
  var propSetterCache = {};
  var objProto = protoOf(alwaysConnectedDom);
  var funcProto = protoOf(protoOf);
  var _undefined;
  var addAndScheduleOnFirst = (set, s, f, waitMs) => (set ?? (setTimeout(f, waitMs), /* @__PURE__ */ new Set())).add(s);
  var runAndCaptureDeps = (f, deps, arg) => {
    let prevDeps = curDeps;
    curDeps = deps;
    try {
      return f(arg);
    } catch (e) {
      console.error(e);
      return arg;
    } finally {
      curDeps = prevDeps;
    }
  };
  var keepConnected = (l) => l.filter((b) => b._dom?.isConnected);
  var addStatesToGc = (d) => statesToGc = addAndScheduleOnFirst(statesToGc, d, () => {
    for (let s of statesToGc)
      s._bindings = keepConnected(s._bindings), s._listeners = keepConnected(s._listeners);
    statesToGc = _undefined;
  }, gcCycleInMs);
  var stateProto = {
    get val() {
      curDeps?._getters?.add(this);
      return this.rawVal;
    },
    get oldVal() {
      curDeps?._getters?.add(this);
      return this._oldVal;
    },
    set val(v) {
      curDeps?._setters?.add(this);
      if (v !== this.rawVal) {
        this.rawVal = v;
        this._bindings.length + this._listeners.length ? (derivedStates?.add(this), changedStates = addAndScheduleOnFirst(changedStates, this, updateDoms)) : this._oldVal = v;
      }
    }
  };
  var state = (initVal) => ({
    __proto__: stateProto,
    rawVal: initVal,
    _oldVal: initVal,
    _bindings: [],
    _listeners: []
  });
  var bind = (f, dom) => {
    let deps = { _getters: /* @__PURE__ */ new Set(), _setters: /* @__PURE__ */ new Set() }, binding = { f }, prevNewDerives = curNewDerives;
    curNewDerives = [];
    let newDom = runAndCaptureDeps(f, deps, dom);
    newDom = (newDom ?? document).nodeType ? newDom : new Text(newDom);
    for (let d of deps._getters)
      deps._setters.has(d) || (addStatesToGc(d), d._bindings.push(binding));
    for (let l of curNewDerives) l._dom = newDom;
    curNewDerives = prevNewDerives;
    return binding._dom = newDom;
  };
  var derive = (f, s = state(), dom) => {
    let deps = { _getters: /* @__PURE__ */ new Set(), _setters: /* @__PURE__ */ new Set() }, listener = { f, s };
    listener._dom = dom ?? curNewDerives?.push(listener) ?? alwaysConnectedDom;
    s.val = runAndCaptureDeps(f, deps, s.rawVal);
    for (let d of deps._getters)
      deps._setters.has(d) || (addStatesToGc(d), d._listeners.push(listener));
    return s;
  };
  var add = (dom, ...children) => {
    for (let c of children.flat(Infinity)) {
      let protoOfC = protoOf(c ?? 0);
      let child = protoOfC === stateProto ? bind(() => c.val) : protoOfC === funcProto ? bind(c) : c;
      child != _undefined && dom.append(child);
    }
    return dom;
  };
  var tag = (ns, name, ...args) => {
    let [{ is, ...props }, ...children] = protoOf(args[0] ?? 0) === objProto ? args : [{}, ...args];
    let dom = ns ? document.createElementNS(ns, name, { is }) : document.createElement(name, { is });
    for (let [k, v] of Object.entries(props)) {
      let getPropDescriptor = (proto) => proto ? Object.getOwnPropertyDescriptor(proto, k) ?? getPropDescriptor(protoOf(proto)) : _undefined;
      let cacheKey = name + "," + k;
      let propSetter = propSetterCache[cacheKey] ??= getPropDescriptor(protoOf(dom))?.set ?? 0;
      let setter = k.startsWith("on") ? (v2, oldV) => {
        let event = k.slice(2);
        dom.removeEventListener(event, oldV);
        dom.addEventListener(event, v2);
      } : propSetter ? propSetter.bind(dom) : dom.setAttribute.bind(dom, k);
      let protoOfV = protoOf(v ?? 0);
      k.startsWith("on") || protoOfV === funcProto && (v = derive(v), protoOfV = stateProto);
      protoOfV === stateProto ? bind(() => (setter(v.val, v._oldVal), dom)) : setter(v);
    }
    return add(dom, children);
  };
  var handler = (ns) => ({ get: (_, name) => tag.bind(_undefined, ns, name) });
  var update = (dom, newDom) => newDom ? newDom !== dom && dom.replaceWith(newDom) : dom.remove();
  var updateDoms = () => {
    let iter = 0, derivedStatesArray = [...changedStates].filter((s) => s.rawVal !== s._oldVal);
    do {
      derivedStates = /* @__PURE__ */ new Set();
      for (let l of new Set(derivedStatesArray.flatMap((s) => s._listeners = keepConnected(s._listeners))))
        derive(l.f, l.s, l._dom), l._dom = _undefined;
    } while (++iter < 100 && (derivedStatesArray = [...derivedStates]).length);
    let changedStatesArray = [...changedStates].filter((s) => s.rawVal !== s._oldVal);
    changedStates = _undefined;
    for (let b of new Set(changedStatesArray.flatMap((s) => s._bindings = keepConnected(s._bindings))))
      update(b._dom, bind(b.f, b._dom)), b._dom = _undefined;
    for (let s of changedStatesArray) s._oldVal = s.rawVal;
  };
  var van_default = {
    tags: new Proxy((ns) => new Proxy(tag, handler(ns)), handler()),
    hydrate: (dom, f) => update(dom, bind(f, dom)),
    add,
    state,
    derive
  };

  // src/utils/utils.ts
  var ready = () => new Promise((resolve) => {
    const t = () => resolve();
    if ("loading" !== document.readyState) {
      queueMicrotask(t);
    } else {
      document.addEventListener("DOMContentLoaded", t);
    }
  });
  var appendCss = (css) => {
    const style = document.createElement("style");
    style.textContent = css;
    document.head.appendChild(style);
  };

  // src/overlay.ts
  var { tags, state: state2, derive: derive2, add: add2 } = van_default;
  var { div, span } = tags;
  var botEnabledState = state2(false);
  var visualizeState = state2(true);
  var radiusMultState = state2(1);
  var autoRespawnState = state2(false);
  var gfxEnabledState = state2(true);
  var prefVisibleState = state2(true);
  var collisionAvoidanceState = state2(false);
  var collisionVisualsState = state2(false);
  var enhancedCollisionState = state2(false);
  var fpsState = state2(0);
  var pingState = state2("0ms");
  var serverState = state2("[0:0:0:0:0:0:0:0]:444");
  var lengthState = state2(0);
  var getToggleClass = (state3) => {
    return derive2(
      () => `pref-overlay__value ${state3.val ? "pref-overlay__value--enabled" : "pref-overlay__value--disabled"}`
    );
  };
  var getToggleValue = (state3) => {
    return derive2(() => state3.val ? "Enabled" : "Disabled");
  };
  var gfxOverlay = div(
    {
      id: "gfx-overlay",
      style: () => gfxEnabledState.val ? "display: none" : ""
    },
    [
      div({ class: "gfx-overlay__item gfx-overlay__title" }, [
        span({ class: "gfx-overlay__label" }, "Graphics Disabled")
      ]),
      div({ class: "gfx-overlay__item gfx-overlay__subtitle" }, [
        span({ class: "gfx-overlay__label" }, "Press "),
        span({ class: "gfx-overlay__value" }, "G"),
        span({ class: "gfx-overlay__label" }, " to toggle graphics.")
      ]),
      div({ class: "gfx-overlay__item gfx-overlay__length" }, [
        span({ class: "gfx-overlay__label" }, "Current Length: "),
        span({ class: "gfx-overlay__value" }, () => lengthState.val.toString())
      ])
    ]
  );
  var prefOverlay = div(
    {
      id: "pref-overlay",
      style: () => `display: ${prefVisibleState.val ? "block" : "none"}`
    },
    [
      div({ class: "pref-overlay__item" }, [
        span({ class: "pref-overlay__label" }, "Version: "),
        span({ class: "pref-overlay__value" }, GM_info.script.version)
      ]),
      div({ class: "pref-overlay__item" }, [
        span({ class: "pref-overlay__label" }, "[T] Toggle Bot: "),
        span(
          { class: getToggleClass(botEnabledState) },
          getToggleValue(botEnabledState)
        )
      ]),
      div({ class: "pref-overlay__item" }, [
        span({ class: "pref-overlay__label" }, "[V] Toggle Visualizer: "),
        span(
          { class: getToggleClass(visualizeState) },
          getToggleValue(visualizeState)
        )
      ]),
      div({ class: "pref-overlay__item" }, [
        span({ class: "pref-overlay__label" }, "[A] Collision Radius: "),
        span({ class: "pref-overlay__value" }, () => radiusMultState.val)
      ]),
      div({ class: "pref-overlay__item" }, [
        span({ class: "pref-overlay__label" }, "[I] Auto Respawn: "),
        span(
          { class: getToggleClass(autoRespawnState) },
          getToggleValue(autoRespawnState)
        )
      ]),
      div({ class: "pref-overlay__item" }, [
        span({ class: "pref-overlay__label" }, "[G] Toggle GFX: "),
        span(
          { class: getToggleClass(gfxEnabledState) },
          getToggleValue(gfxEnabledState)
        )
      ]),
      div({ class: "pref-overlay__item" }, [
        span({ class: "pref-overlay__label" }, "[Esc] Quick Respawn")
      ]),
      div({ class: "pref-overlay__item" }, [
        span({ class: "pref-overlay__label" }, "[Q] Quit Game")
      ]),
      div({ class: "pref-overlay__item" }, [
        span({ class: "pref-overlay__label" }, "[H] Toggle Overlay")
      ]),
      div({ class: "pref-overlay__item" }, [
        span({ class: "pref-overlay__label" }, "[Mouse Wheel] Zoom")
      ]),
      div({ class: "pref-overlay__item" }, [
        span({ class: "pref-overlay__label" }, "[W] Collision Avoidance: "),
        span(
          { class: getToggleClass(collisionAvoidanceState) },
          getToggleValue(collisionAvoidanceState)
        )
      ]),
      div({ class: "pref-overlay__item" }, [
        span({ class: "pref-overlay__label" }, "[X] Collision Visuals: "),
        span(
          { class: getToggleClass(collisionVisualsState) },
          getToggleValue(collisionVisualsState)
        )
      ]),
      div({ class: "pref-overlay__item" }, [
        span({ class: "pref-overlay__label" }, "[E] Enhanced Collision: "),
        span(
          { class: getToggleClass(enhancedCollisionState) },
          getToggleValue(enhancedCollisionState)
        )
      ]),
      div({ class: "pref-overlay__item" }, [
        span({ class: "pref-overlay__label" }, "Control Mode: "),
        span(
          { class: "pref-overlay__value" },
          () => collisionAvoidance.controlActive ? "FULL CONTROL" : "User Control"
        )
      ]),
      div({ class: "pref-overlay__item" }, [
        span({ class: "pref-overlay__label" }, "[N/M] Zoom In/Out")
      ]),
      div({ class: "pref-overlay__item" }, [
        span({ class: "pref-overlay__label" }, "[Z] Reset Zoom")
      ])
    ]
  );
  var hudOverlay = div({ id: "hud-overlay" }, [
    div({ class: "hud-overlay__item" }, [
      span({ class: "hud-overlay__label" }, "FPS: "),
      span({ class: "hud-overlay__value" }, () => fpsState.val)
    ]),
    div({ class: "hud-overlay__item" }, [
      span({ class: "hud-overlay__label" }, "Ping: "),
      span(
        { class: "hud-overlay__value", style: "min-width: 3em;" },
        () => pingState.val
      )
    ]),
    div({ class: "hud-overlay__item" }, [
      span({ class: "hud-overlay__label" }, "IP: "),
      span({ class: "hud-overlay__value" }, () => serverState.val)
    ])
  ]);
  ready().then(() => {
    add2(document.body, prefOverlay, hudOverlay, gfxOverlay);
  });

  // src/event.ts
  var toggleBot = () => {
    botEnabledState.val = !botEnabledState.val;
  };
  var toggleVisualizer = () => {
    visualizeState.val = !visualizeState.val;
    bot.visualizeEnabled(visualizeState.val);
  };
  var increaseRadiusMult = () => {
    bot.opt.radiusMult = Math.min(bot.opt.radiusMult + 1, 30);
    radiusMultState.val = bot.opt.radiusMult;
  };
  var decreaseRadiusMult = () => {
    bot.opt.radiusMult = Math.max(bot.opt.radiusMult - 1, 1);
    radiusMultState.val = bot.opt.radiusMult;
  };
  var initRadiusMult = () => {
    radiusMultState.val = bot.opt.radiusMult;
  };
  var toggleAutoRespawn = () => {
    autoRespawnState.val = !autoRespawnState.val;
  };
  var toggleGfx = () => {
    gfxEnabledState.val = !gfxEnabledState.val;
    window.animating = gfxEnabledState.val;
  };
  var toggleCollisionAvoidance = () => {
    collisionAvoidanceState.val = !collisionAvoidanceState.val;
    collisionAvoidance.enabled = collisionAvoidanceState.val;
  };
  var toggleCollisionVisuals = () => {
    collisionVisualsState.val = !collisionVisualsState.val;
    collisionAvoidance.visualsEnabled = collisionVisualsState.val;
  };
  var quickRespawn = () => {
    if (window.playing) {
      window.resetGame();
      window.connect();
    }
  };
  var quitGame = () => {
    if (window.playing) {
      window.dead_mtm = 0;
      window.play_btn.setEnabled(true);
      window.resetGame();
    }
  };
  var togglePrefVisibility = () => {
    prefVisibleState.val = !prefVisibleState.val;
  };
  var setZoom = (dir) => {
    if (window.slither !== null && window.playing && window.connected && !window.choosing_skin) {
      zoom.adjust(dir);
    }
  };
  var resetZoom = () => {
    zoom.set(window.sgsc);
  };
  var keyMap = {
    t: () => {
      toggleBot();
    },
    y: () => {
      toggleVisualizer();
    },
    a: () => {
      increaseRadiusMult();
    },
    s: () => {
      decreaseRadiusMult();
    },
    i: () => {
      toggleAutoRespawn();
    },
    g: () => {
      toggleGfx();
    },
    escape: () => {
      quickRespawn();
    },
    q: () => {
      quitGame();
    },
    h: () => {
      togglePrefVisibility();
    },
    n: () => {
      setZoom(-1);
    },
    m: () => {
      setZoom(1);
    },
    z: () => {
      resetZoom();
    },
    w: () => {
      toggleCollisionAvoidance();
    },
    x: () => {
      toggleCollisionVisuals();
    },
    e: () => {
      enhancedCollisionState.val = !enhancedCollisionState.val;
      collisionAvoidance.enabled = enhancedCollisionState.val;
    }
  };
  var initEventListeners = () => {
    const original_onmousedown = window.onmousedown?.bind(window) ?? (() => {
    });
    const original_onmousemove = window.onmousemove?.bind(window) ?? (() => {
    });
    function handleKeydown(e) {
      const key = e.key.toLowerCase();
      console.log(key);
      keyMap[key]?.();
    }
    function handleMousedown(e) {
      if (window.playing) {
        if (e.button === 0) {
          bot.defaultAccel = 1;
          if (!botEnabledState.val) original_onmousedown(e);
        } else if (e.button === 2) {
          botEnabledState.val = !botEnabledState.val;
        }
      } else {
        original_onmousedown(e);
      }
    }
    function handleMouseup(e) {
      bot.defaultAccel = 0;
    }
    function handleMousemove(e) {
      if (!botEnabledState.val) {
        original_onmousemove(e);
        return;
      }
    }
    document.addEventListener("keydown", handleKeydown);
    window.onmousedown = handleMousedown;
    window.onmousemove = handleMousemove;
    window.addEventListener("mouseup", handleMouseup);
    window.addEventListener("wheel", (e) => setZoom(Math.sign(e.deltaY)));
    initRadiusMult();
  };

  // src/style.css
  var style_default = '#pref-overlay {\r\n  position: fixed;\r\n  left: 8px;\r\n  top: 128px;\r\n  z-index: 1000;\r\n  color: rgb(255 255 255);\r\n  font-size: 0.75rem;\r\n  font-family: Arial, "Helvetica Neue", Helvetica, sans-serif;\r\n  text-shadow: rgb(0 0 0) 0px 1px 8px;\r\n  padding-block: 0.5rem;\r\n  padding-inline: 0;\r\n  overflow: hidden;\r\n  transform: translateZ(0);\r\n\r\n  .pref-overlay__label {\r\n    display: inline-block;\r\n    opacity: 0.7;\r\n  }\r\n\r\n  .pref-overlay__value {\r\n    display: inline-block;\r\n    opacity: 0.75;\r\n  }\r\n\r\n  .pref-overlay__value--enabled {\r\n    color: #00ff00;\r\n  }\r\n\r\n  .pref-overlay__value--disabled {\r\n    color: #ff0000;\r\n  }\r\n}\r\n\r\n#hud-overlay {\r\n  position: fixed;\r\n  bottom: 192px;\r\n  right: 8px;\r\n  z-index: 1000;\r\n  color: rgb(255 255 255);\r\n  font-size: 0.75rem;\r\n  font-family: Arial, "Helvetica Neue", Helvetica, sans-serif;\r\n  text-shadow: rgb(0 0 0) 0px 1px 8px;\r\n  text-align: right;\r\n  padding-block: 0.5rem;\r\n  padding-inline: 0;\r\n  overflow: hidden;\r\n  transform: translateZ(0);\r\n\r\n  .hud-overlay__label {\r\n    display: inline-block;\r\n    opacity: 0.6;\r\n  }\r\n\r\n  .hud-overlay__value {\r\n    display: inline-block;\r\n    opacity: 0.65;\r\n  }\r\n}\r\n\r\n#gfx-overlay {\r\n  position: fixed;\r\n  inset: 0;\r\n  z-index: 1000;\r\n  color: rgb(255 255 255);\r\n  font-size: 0.75rem;\r\n  font-family: Arial, "Helvetica Neue", Helvetica, sans-serif;\r\n  background-color: #000000;\r\n  text-align: center;\r\n  width: 100vw;\r\n  height: 100vh;\r\n  transform: translateZ(0);\r\n  display: flex;\r\n  justify-content: center;\r\n  align-items: center;\r\n  flex-direction: column;\r\n\r\n  .gfx-overlay__title {\r\n    font-size: 2rem;\r\n    font-weight: bold;\r\n    margin-block: 1rem;\r\n  }\r\n\r\n  .gfx-overlay__subtitle {\r\n    font-size: 1.5rem;\r\n    margin-block: 0.5rem;\r\n  }\r\n\r\n  .gfx-overlay__length {\r\n    font-size: 1rem;\r\n    margin-block: 0.5rem;\r\n  }\r\n\r\n  .gfx-overlay__label {\r\n    display: inline-block;\r\n    opacity: 0.8;\r\n  }\r\n\r\n  .gfx-overlay__value {\r\n    display: inline-block;\r\n    opacity: 0.85;\r\n  }\r\n}\r\n';

  // src/index.ts
  var isBotRunning = false;
  var init = () => {
    const original_oef = window.oef;
    const original_connect = window.connect;
    window.oef = () => {
      const ctm = window.timeObj.now();
      window.gsc = zoom.get();
      if (ctm - window.lrd_mtm > 1e3) {
        fpsState.val = window.fps;
      }
      original_oef();
      if (window.playing && botEnabledState.val && window.slither !== null) {
        isBotRunning = true;
        bot.go();
      } else if (botEnabledState.val && isBotRunning) {
        isBotRunning = false;
        if (autoRespawnState.val) {
          window.connect();
        }
      }

      // Run collision avoidance when not in bot mode (full control mode)
      if (window.playing && !botEnabledState.val && collisionAvoidance.enabled && window.slither) {
        const avoidanceDirection = collisionAvoidance.update(
          window.slither,
          window.slithers,
          window.grd
        );

        if (avoidanceDirection !== null) {
          // Full control mode - set exact direction, user controls speed only
          const newX = window.slither.xx + Math.cos(avoidanceDirection) * 100;
          const newY = window.slither.yy + Math.sin(avoidanceDirection) * 100;

          window.xm = newX - window.view_xx;
          window.ym = newY - window.view_yy;

          console.log(`Collision Avoidance Full Control: Direction ${(avoidanceDirection * 180 / Math.PI).toFixed(1)}°`);
        }
      }

      // Always run visual debugging if enabled
      if (window.playing && collisionAvoidance.visualsEnabled && window.slither) {
        collisionAvoidance.drawDebugVisuals(
          { x: window.slither.xx, y: window.slither.yy },
          window.slither.ang,
          collisionAvoidance.getSnakeWidth(window.slither.sc) / 2
        );
      }

      if (window.slither !== null) {
        lengthState.val = bot.getSnakeLength(window.slither);
      }
    };
    window.connect = () => {
      original_connect();
      const original_gotPacket = window.gotPacket;
      window.gotPacket = (a) => {
        original_gotPacket(a);
        const cmd = String.fromCharCode(a[0]);
        switch (cmd) {
          case "a": {
            const server = `${window.bso.ip}:${window.bso.po}`;
            serverState.val = server;
            break;
          }
          case "p": {
            const ping = window.timeObj.now() - window.lpstm;
            pingState.val = `${~~ping}ms`;
            break;
          }
        }
      };
    };
    appendCss(style_default);
    initEventListeners();
    zoom.set(window.gsc);
  };
  var findGameScript = async () => {
    const abortController = new AbortController();
    setTimeout(() => abortController.abort(), 5e3);
    return new Promise((resolve, reject) => {
      if (document.querySelector("script[src*='game']")) {
        resolve();
        return;
      }
      const observer = new MutationObserver(() => {
        const script = document.querySelector("script[src*='game']");
        if (script && script instanceof HTMLScriptElement) {
          observer.disconnect();
          script.addEventListener("load", () => resolve(), { once: true });
        }
      });
      observer.observe(document.documentElement, {
        childList: true,
        subtree: true
      });
      abortController.signal.addEventListener("abort", () => {
        observer.disconnect();
        reject(new Error("Game script not found"));
      });
    });
  };
  Promise.all([ready(), findGameScript()]).then(() => init()).catch(console.error);
})();
