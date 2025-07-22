import { Bot } from "./bot";
import { Zoom } from "./zoom";

export const zoom = new Zoom();
export const bot = new Bot();

bot.onSetCoordinates = (x, y) => {
	window.xm = x - window.view_xx;
	window.ym = y - window.view_yy;
};

bot.onAcceleration = (accel) => {
	window.setAcceleration(accel);
};

// God Mode Assist - independent of bot
export const checkGodModeAssist = () => {
	return bot.checkGodModeAssist();
};
