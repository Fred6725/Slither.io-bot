import { bot, zoom } from "./core";
import {
	autoRespawnState,
	botEnabledState,
	gfxEnabledState,
	prefVisibleState,
	radiusMultState,
	visualizeState,
	godModeEnabledState,
	godModeVisualsState,
} from "./overlay";

const toggleBot = () => {
	botEnabledState.val = !botEnabledState.val;
};

const toggleVisualizer = () => {
	visualizeState.val = !visualizeState.val;
	bot.visualizeEnabled(visualizeState.val);
};

const toggleGodMode = () => {
	console.log("🔧 toggleGodMode() called");
	const oldVal = godModeEnabledState.val;
	godModeEnabledState.val = !godModeEnabledState.val;
	console.log(`🔧 God Mode state: ${oldVal} -> ${godModeEnabledState.val}`);
	bot.godModeEnabled(godModeEnabledState.val);
	console.log("🔥 God Mode Assist:", godModeEnabledState.val ? "ENABLED" : "DISABLED");
};

const toggleGodModeVisuals = () => {
	console.log("🔧 toggleGodModeVisuals() called");
	const oldVal = godModeVisualsState.val;
	godModeVisualsState.val = !godModeVisualsState.val;
	console.log(`🔧 God Mode Visuals state: ${oldVal} -> ${godModeVisualsState.val}`);
	bot.godModeVisualsEnabled(godModeVisualsState.val);
	console.log("👁️ God Mode Visuals:", godModeVisualsState.val ? "ENABLED" : "DISABLED");
};

const increaseRadiusMult = () => {
	bot.opt.radiusMult = Math.min(bot.opt.radiusMult + 1, 30);
	radiusMultState.val = bot.opt.radiusMult;
};

const decreaseRadiusMult = () => {
	bot.opt.radiusMult = Math.max(bot.opt.radiusMult - 1, 1);
	radiusMultState.val = bot.opt.radiusMult;
};

const initRadiusMult = () => {
	radiusMultState.val = bot.opt.radiusMult;
};

const toggleAutoRespawn = () => {
	autoRespawnState.val = !autoRespawnState.val;
};

const toggleGfx = () => {
	gfxEnabledState.val = !gfxEnabledState.val;
	window.animating = gfxEnabledState.val;
};

const quickRespawn = () => {
	if (window.playing) {
		window.resetGame();
		window.connect();
	}
};

const quitGame = () => {
	if (window.playing) {
		window.dead_mtm = 0;
		window.play_btn.setEnabled(true);
		window.resetGame();
	}
};

const togglePrefVisibility = () => {
	prefVisibleState.val = !prefVisibleState.val;
};

const setZoom = (dir: number) => {
	if (
		window.slither !== null &&
		window.playing &&
		window.connected &&
		!window.choosing_skin
	) {
		zoom.adjust(dir);
	}
};

const resetZoom = () => {
	zoom.set(window.sgsc);
};

const keyMap: Record<string, () => void> = {
	t: () => {
		toggleBot();
	},
	y: () => {
		toggleVisualizer();
	},
	g: () => {
		toggleGodMode();
	},
	x: () => {
		toggleGodModeVisuals();
	},
	f: () => {
		toggleGfx();
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
};

export const initEventListeners = () => {
	// Save the original slither.io event handlers so we can modify them, or reenable them later.
	const original_onmousedown = window.onmousedown?.bind(window) ?? (() => {});
	const original_onmousemove = window.onmousemove?.bind(window) ?? (() => {});

	function handleKeydown(e: KeyboardEvent) {
		const key = e.key.toLowerCase();
		console.log(`🔧 Key pressed: '${key}'`);
		if (keyMap[key]) {
			console.log(`🔧 Executing function for key: '${key}'`);
			keyMap[key]();
		} else {
			console.log(`🔧 No function mapped for key: '${key}'`);
		}
	}

	function handleMousedown(e: MouseEvent) {
		if (window.playing) {
			// left click
			if (e.button === 0) {
				bot.defaultAccel = 1;
				if (!botEnabledState.val) original_onmousedown(e);
			}
			// right click
			else if (e.button === 2) {
				botEnabledState.val = !botEnabledState.val;
			}
		} else {
			original_onmousedown(e);
		}
	}

	function handleMouseup(e: MouseEvent) {
		bot.defaultAccel = 0;
	}

	function handleMousemove(e: MouseEvent) {
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
