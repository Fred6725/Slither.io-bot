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
| U | **God Mode enabled/disabled** |
| I | Automatic Respawning |
| G | No graphics mode |
| H | Hide overlays |
| A / S | Collision radius multiplier increase / decrease |
| Z | Reset zoom |
| Mouse wheel / M / N | Zoom in/out |
| ESC | Quick respawn |
| Q | Quit to menu |

## God Mode Features

The bot now includes an experimental **God Mode** that provides enhanced collision avoidance:

- **Predictive Trajectory Analysis**: Predicts enemy snake movements up to 30 frames ahead
- **Emergency Avoidance**: Automatically overrides normal bot behavior when immediate collision threats are detected
- **Threat Level Assessment**: Analyzes multiple threats simultaneously and prioritizes the most dangerous ones
- **Enhanced Survival**: Significantly improves survival rate in high-traffic areas

**Note**: God Mode is currently in alpha and focuses on collision avoidance. Kill opportunity detection will be added in future versions.
