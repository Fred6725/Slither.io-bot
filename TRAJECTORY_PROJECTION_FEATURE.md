# Trajectory Projection Feature

## Overview

The trajectory projection feature uses **3 derivatives** to predict where the snake will be in the next 2 seconds based on its recent movement history. This provides valuable debugging information and helps visualize the bot's movement patterns.

## How It Works

### 1. **Data Collection**
- Tracks the last 5 positions and angles of the snake
- Records timestamps for accurate velocity calculations
- Updates every frame during gameplay

### 2. **3-Derivative Analysis**
- **1st Derivative**: Velocity (speed and direction)
- **2nd Derivative**: Acceleration (change in velocity)
- **3rd Derivative**: Angular acceleration (change in turn rate)

### 3. **Projection Methods**
- **Linear Projection**: Used when turning is minimal (straight movement)
- **Circular Arc Projection**: Used when actively turning (curved movement)

## Visual Elements

### **Trajectory History**
- **Dark Blue Line**: Shows the last 5 positions the snake has been
- **Thickness**: 3 pixels with 60% opacity

### **Projected Trajectory**
- **Color-coded by turn rate**:
  - 🟢 **Lime**: Straight movement (turn rate < 0.1 rad/s)
  - 🟡 **Yellow**: Gentle turning (turn rate 0.1-0.3 rad/s)
  - 🟠 **Orange**: Sharp turning (turn rate 0.3-0.5 rad/s)
  - 🔴 **Red**: Very sharp turning (turn rate > 0.5 rad/s)

### **Trajectory Points**
- **White Dots**: Small circles at regular intervals along the projection
- **Magenta Circle**: End point of the 2-second projection

### **Fading Effect**
- Trajectory fades from 80% to 20% opacity over time
- Makes it easier to see the most likely immediate path

## Controls

- **Press P**: Toggle trajectory projection on/off
- **Status**: Shows in the overlay as "Trajectory Projection: Enabled/Disabled"

## Console Output

When enabled, the console shows:
```
🎯 Trajectory Projection: Speed=45.2px/s, TurnRate=12.3°/s, ProjectionTime=2.0s, Points=20
```

## Technical Details

### **Mathematical Approach**
1. **Velocity Calculation**: `v = (pos_now - pos_prev) / dt`
2. **Acceleration Calculation**: `a = (v_now - v_prev) / dt`
3. **Angular Velocity**: `ω = (angle_now - angle_prev) / dt`
4. **Angular Acceleration**: `α = (ω_now - ω_prev) / dt`

### **Projection Logic**
```javascript
if (|α| < 0.1 && |ω| < 0.1) {
    // Linear projection with acceleration
    x = x0 + vx*t + 0.5*ax*t²
    y = y0 + vy*t + 0.5*ay*t²
} else {
    // Circular arc projection
    radius = speed / |ω|
    angle_change = ω*t + 0.5*α*t²
    // Calculate position on arc
}
```

## Use Cases

### **Debugging**
- Verify collision avoidance predictions
- Check if the bot's movement matches expectations
- Identify unexpected movement patterns

### **Development**
- Tune collision detection parameters
- Optimize turn radius calculations
- Validate combat mode decisions

### **Player Feedback**
- See where your current input will lead
- Understand movement physics
- Plan strategic maneuvers

## Configuration

### **Adjustable Parameters**
- `trajectoryProjectionTime`: How far ahead to project (default: 2.0 seconds)
- `trajectoryProjectionSteps`: Number of points in projection (default: 20)
- `maxTrajectoryHistory`: Number of historical points to track (default: 5)

### **Performance**
- Minimal impact on frame rate
- Only calculates when visual debugging is enabled
- Console output limited to 10% of frames to prevent spam

## Integration

The trajectory projection integrates seamlessly with:
- **Turn Radius Calibration**: Shows alongside turn arcs
- **Collision Avoidance**: Helps visualize danger zones
- **Combat Mode**: Assists with tactical decisions
- **Debug Mode**: Part of comprehensive visual debugging suite

## Future Enhancements

Potential improvements:
- **Multi-snake projection**: Show projected paths of nearby enemies
- **Collision prediction**: Highlight where trajectories intersect
- **Confidence intervals**: Show uncertainty in projections
- **Customizable colors**: User-defined color schemes
- **Export data**: Save trajectory data for analysis