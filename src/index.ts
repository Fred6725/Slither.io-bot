import { bot, zoom, checkGodModeAssist } from "./core";
import { initEventListeners } from "./event";
import {
	autoRespawnState,
	botEnabledState,
	fpsState,
	lengthState,
	pingState,
	serverState,
} from "./overlay";
import css from "./style.css";
import { appendCss, ready } from "./utils";

let isBotRunning = false;

const init = () => {
	const original_oef = window.oef;
	const original_connect = window.connect;

	window.oef = () => {
		const ctm = window.timeObj.now();

		window.gsc = zoom.get();
		if (ctm - window.lrd_mtm > 1e3) {
			fpsState.val = window.fps;
		}

		original_oef();

		// God Mode Assist - works independently of bot
		if (window.playing && window.slither !== null) {
			checkGodModeAssist();
			
			// Draw god mode visuals independently
			if (bot.isGodModeVisualsEnabled()) {
				bot.drawGodModeVisuals();
			}
		}

		// Bot behavior
		if (window.playing && botEnabledState.val && window.slither !== null) {
			isBotRunning = true;
			bot.go();
		} else if (botEnabledState.val && isBotRunning) {
			isBotRunning = false;

			if (autoRespawnState.val) {
				window.connect();
			}
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

	appendCss(css);
	initEventListeners();
	zoom.set(window.gsc);
};

const findGameScript = async () => {
	const abortController = new AbortController();
	setTimeout(() => abortController.abort(), 5000);

	return new Promise<void>((resolve, reject) => {
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
			subtree: true,
		});

		abortController.signal.addEventListener("abort", () => {
			observer.disconnect();
			reject(new Error("Game script not found"));
		});
	});
};

Promise.all([ready(), findGameScript()])
	.then(() => init())
	.catch(console.error);
