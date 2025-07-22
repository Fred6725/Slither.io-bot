# Slither.io Bot Championship Edition

## Introduction

The Championship Edition bot was an excellent bot script that keeps circling and growing (known as kiosking), but in 2018 it became a public archive and was no longer maintained.
Eventually, the official game code was updated and this script no longer works.

This repository is based on the Championship Edition code and adapted to the new game code.

## Installation

- If you are on Chrome or Chromium-based browsers, install the [**Tampermonkey extension**](https://chromewebstore.google.com/detail/tampermonkey/dhdgffkkebhmkfjojejmpbldmpobfkfo).
- On other browsers, install the [**Greasemonkey**](https://addons.mozilla.org/en-US/firefox/addon/greasemonkey/).
- Once installed, click [**here**](https://raw.githubusercontent.com/saya-0x0efe/Slither.io-bot/refs/heads/main/userscript/bot.user.js) to install the script.
- Go to [**slither.io**](http://slither.io/) and enjoy the bot!

## Hotkeys

|Key | Result |
|---|---|
| T / Right Click | Bot enabled/disabled |
| Y | Visual debugging |
| G | **God Mode Assist enabled/disabled** |
| X | **God Mode Visuals enabled/disabled** |
| I | Automatic Respawning |
| F | No graphics mode |
| H | Hide overlays |
| A / S | Collision radius multiplier increase / decrease |
| Z | Reset zoom |
| Mouse wheel / M / N | Zoom in/out |
| ESC | Quick respawn |
| Q | Quit to menu |

## God Mode Assist Features

The bot now includes an experimental **God Mode Assist** - a standalone collision avoidance system that works independently from the bot:

### 🎯 **Key Features:**
- **Independent Operation**: Works whether the bot is enabled or disabled - pure player assist
- **Emergency Takeover**: Only takes control when immediate collision danger is detected
- **Precision Avoidance**: Uses advanced angle calculations for minimal, precise corrections
- **Smart Direction**: Analyzes multiple escape routes and chooses the safest path
- **Transparent Operation**: Most of the time you won't notice it's there

### 🔧 **How It Works:**
1. **Continuous Monitoring**: Constantly analyzes nearby threats while you play
2. **Danger Detection**: Calculates threat levels based on distance, angle, and collision probability
3. **Emergency Response**: Takes temporary control only when collision is imminent
4. **Quick Release**: Returns control to you as soon as you're safe

### 🎮 **Usage:**
- **Press G** to enable/disable God Mode Assist
- **Press X** to toggle visual debugging (shows danger zones and threat indicators)
- The system works independently of the bot - use it for manual play assistance
- Visual indicators show when the system is monitoring vs actively controlling

### 🎨 **Visual Indicators (Press X):**
- **Yellow Circle**: Danger detection radius
- **Red Circle**: Emergency response radius  
- **Red Text**: "GOD MODE ACTIVE" when system has taken control
- **Green Line**: Direction of emergency avoidance
- **Threat Level**: Percentage indicator of current danger

This system is designed to make you virtually invincible while maintaining the feel of manual gameplay!
