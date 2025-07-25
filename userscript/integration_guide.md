# Integration Guide: Reactive Collision Avoidance System

## Overview

This guide shows how to replace the existing collision avoidance system in your bot.v2/v3 userscript with the new reactive system that meets your requirements:

1. ✅ **Forces trajectory takeover** when death is imminent
2. ✅ **Prevents killing moves** before they happen  
3. ✅ **Uses worst-case scenarios** instead of prediction
4. ✅ **Corrects human errors** in real-time
5. ✅ **Manages all size/boost combinations**

## Step 1: Replace the CollisionAvoidance Class

In your userscript, find the existing `CollisionAvoidance` class (around line 200-800) and replace it entirely with the `ReactiveCollisionAvoidance` class from `reactive_collision_system.js`.

## Step 2: Update the Main Game Loop

In your `window.oef` function (around line 3000), replace this section:

```javascript
// OLD CODE (Remove this):
if (window.playing && !botEnabledState.val && collisionAvoidance.enabled && window.slither) {
  const avoidanceDirection = collisionAvoidance.update(
    window.slither,
    window.slithers,
    window.grd
  );

  if (avoidanceDirection !== null) {
    const newX = window.slither.xx + Math.cos(avoidanceDirection) * 100;
    const newY = window.slither.yy + Math.sin(avoidanceDirection) * 100;
    window.xm = newX - window.view_xx;
    window.ym = newY - window.view_yy;
  }
}
```

With this **NEW CODE**:

```javascript
// NEW REACTIVE SYSTEM:
if (window.playing && window.slither && reactiveCollisionAvoidance.enabled) {
  const avoidanceDirection = reactiveCollisionAvoidance.update(
    window.slither,
    window.slithers,
    window.grd
  );

  if (avoidanceDirection !== null) {
    // Reactive defense is taking control
    const newX = window.slither.xx + Math.cos(avoidanceDirection) * 100;
    const newY = window.slither.yy + Math.sin(avoidanceDirection) * 100;
    
    window.xm = newX - window.view_xx;
    window.ym = newY - window.view_yy;
    
    // Optional: Visual/audio feedback
    console.log(`🛡️ REACTIVE DEFENSE: ${reactiveCollisionAvoidance.emergencyOverride ? 'EMERGENCY' : 'PROTECTION'}`);
  }
}
```

## Step 3: Update Keybindings

In your `keyMap` object (around line 2950), add/update these keys:

```javascript
const keyMap = {
  // ... existing keys ...
  
  // Replace old collision avoidance keys with reactive system
  'w': () => {
    reactiveCollisionAvoidance.toggle();
  },
  'x': () => {
    reactiveCollisionAvoidance.toggleVisuals();
  },
  
  // Optional: Protection level switching
  'b': () => {
    // Cycle through protection modes
    if (reactiveCollisionAvoidance.baseSafetyMargin === 30) {
      ProtectionModes.setBalanced();
    } else if (reactiveCollisionAvoidance.baseSafetyMargin === 50) {
      ProtectionModes.setConservative();
    } else {
      ProtectionModes.setAggressive();
    }
  }
};
```

## Step 4: Update State Management

In your state declarations (around line 2780), replace the collision states:

```javascript
// OLD STATES (Remove these):
// var collisionAvoidanceState = state2(false);
// var collisionVisualsState = state2(false);
// var enhancedCollisionState = state2(false);

// NEW REACTIVE STATES:
var reactiveDefenseState = state2(false);
var reactiveVisualsState = state2(false);
var protectionModeState = state2('BALANCED');
```

## Step 5: Update UI Overlay

In your `prefOverlay` div (around line 2820), replace the collision UI elements:

```javascript
// Replace old collision UI with:
div({ class: "pref-overlay__item" }, [
  span({ class: "pref-overlay__label" }, "[W] Reactive Defense: "),
  span(
    { class: getToggleClass(reactiveDefenseState) },
    getToggleValue(reactiveDefenseState)
  )
]),
div({ class: "pref-overlay__item" }, [
  span({ class: "pref-overlay__label" }, "[X] Defense Visuals: "),
  span(
    { class: getToggleClass(reactiveVisualsState) },
    getToggleValue(reactiveVisualsState)
  )
]),
div({ class: "pref-overlay__item" }, [
  span({ class: "pref-overlay__label" }, "[B] Protection Mode: "),
  span({ class: "pref-overlay__value" }, () => protectionModeState.val)
]),
div({ class: "pref-overlay__item" }, [
  span({ class: "pref-overlay__label" }, "Defense Status: "),
  span(
    { class: "pref-overlay__value" },
    () => reactiveCollisionAvoidance.controlActive ? 
      (reactiveCollisionAvoidance.emergencyOverride ? "🚨 EMERGENCY" : "🛡️ PROTECTING") : 
      "👤 USER CONTROL"
  )
])
```

## Step 6: Initialize the New System

Add this initialization code after your existing setup:

```javascript
// Initialize reactive collision avoidance
const reactiveCollisionAvoidance = new ReactiveCollisionAvoidance(visualizer);

// Configure initial settings
reactiveCollisionAvoidance.enabled = false; // Start disabled
reactiveCollisionAvoidance.visualsEnabled = false;

// Set up protection modes
class ProtectionModes {
  static setConservative() {
    reactiveCollisionAvoidance.baseSafetyMargin = 80;
    reactiveCollisionAvoidance.boostTurnPenalty = 3.0;
    reactiveCollisionAvoidance.baseLookaheadDistance = 250;
    protectionModeState.val = 'CONSERVATIVE';
  }
  
  static setBalanced() {
    reactiveCollisionAvoidance.baseSafetyMargin = 50;
    reactiveCollisionAvoidance.boostTurnPenalty = 2.0;
    reactiveCollisionAvoidance.baseLookaheadDistance = 180;
    protectionModeState.val = 'BALANCED';
  }
  
  static setAggressive() {
    reactiveCollisionAvoidance.baseSafetyMargin = 30;
    reactiveCollisionAvoidance.boostTurnPenalty = 1.5;
    reactiveCollisionAvoidance.baseLookaheadDistance = 120;
    protectionModeState.val = 'AGGRESSIVE';
  }
}

// Start with balanced mode
ProtectionModes.setBalanced();
```

## Step 7: Update Toggle Functions

Replace the old toggle functions with reactive ones:

```javascript
// Replace old functions:
var toggleReactiveDefense = () => {
  reactiveDefenseState.val = !reactiveDefenseState.val;
  reactiveCollisionAvoidance.enabled = reactiveDefenseState.val;
  console.log(`🛡️ Reactive Defense: ${reactiveDefenseState.val ? 'ENABLED' : 'DISABLED'}`);
};

var toggleReactiveVisuals = () => {
  reactiveVisualsState.val = !reactiveVisualsState.val;
  reactiveCollisionAvoidance.visualsEnabled = reactiveVisualsState.val;
  console.log(`👁️ Defense Visuals: ${reactiveVisualsState.val ? 'ENABLED' : 'DISABLED'}`);
};
```

## Step 8: Test the Integration

1. **Start the game** with the new system
2. **Press W** to enable reactive defense
3. **Press X** to enable visual debugging
4. **Try moving toward danger** - the system should block dangerous moves
5. **Get close to collision** - the system should take emergency control
6. **Press B** to cycle through protection modes

## Expected Behavior

### Normal Operation:
- **Yellow line** shows where you want to go (mouse intent)
- **No interference** when moving safely
- **System stays inactive** until danger detected

### Protection Mode:
- **🛡️ MOVE CORRECTED** - System prevents dangerous mouse movement
- **Minimal deviation** from your intended path
- **User control returns** immediately when safe

### Emergency Mode:
- **🚨 EMERGENCY** - System takes full control
- **Immediate escape maneuver** from imminent collision
- **Red indicator** shows emergency override active

## Key Improvements Over v2/v3

1. **No False Positives**: Only activates for real danger
2. **Preserves Intent**: Tries to follow your mouse direction when possible
3. **Worst-Case Safety**: Uses maximum turn radius calculations
4. **Clear Feedback**: Shows exactly when and why it's taking control
5. **Configurable**: Three protection modes for different play styles
6. **No Prediction Errors**: Reactive only, no complex trajectory math

## Troubleshooting

### If the system is too sensitive:
```javascript
ProtectionModes.setAggressive(); // Less protection
```

### If you're still dying:
```javascript
ProtectionModes.setConservative(); // More protection
```

### If the system isn't activating:
- Check that `reactiveDefenseState.val` is `true`
- Verify mouse movement is being tracked
- Enable visuals to see danger zones

This new system gives you exactly what you asked for: a reactive defense that prevents death without complex prediction, while preserving your control and improving your performance through mistake correction.