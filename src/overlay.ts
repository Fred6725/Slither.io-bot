import van, { type State } from "vanjs-core";
import { ready } from "./utils";

const { tags, state, derive, add } = van;
const { div, span } = tags;

export const botEnabledState = state(false);
export const visualizeState = state(true);
export const radiusMultState = state(1);
export const autoRespawnState = state(false);
export const gfxEnabledState = state(true);
export const prefVisibleState = state(true);

// God Mode states
export const godModeEnabledState = state(false);
export const godModeVisualsState = state(false);

export const fpsState = state(0);
export const pingState = state<`${number}ms`>("0ms");
export const serverState = state("[0:0:0:0:0:0:0:0]:444");

export const lengthState = state(0);

const getToggleClass = (state: State<boolean>) => {
	return derive(
		() =>
			`pref-overlay__value ${state.val ? "pref-overlay__value--enabled" : "pref-overlay__value--disabled"}`,
	);
};
const getToggleValue = (state: State<boolean>) => {
	return derive(() => (state.val ? "Enabled" : "Disabled"));
};

export const gfxOverlay = div(
	{
		id: "gfx-overlay",
		style: () => (gfxEnabledState.val ? "display: none" : ""),
	},
	[
		div({ class: "gfx-overlay__item gfx-overlay__title" }, [
			span({ class: "gfx-overlay__label" }, "Graphics Disabled"),
		]),
		div({ class: "gfx-overlay__item gfx-overlay__subtitle" }, [
			span({ class: "gfx-overlay__label" }, "Press "),
			span({ class: "gfx-overlay__value" }, "G"),
			span({ class: "gfx-overlay__label" }, " to toggle graphics."),
		]),
		div({ class: "gfx-overlay__item gfx-overlay__length" }, [
			span({ class: "gfx-overlay__label" }, "Current Length: "),
			span({ class: "gfx-overlay__value" }, () => lengthState.val.toString()),
		]),
	],
);

export const prefOverlay = div(
	{
		id: "pref-overlay",
		style: () => `display: ${prefVisibleState.val ? "block" : "none"}`,
	},
	[
		div({ class: "pref-overlay__item" }, [
			span({ class: "pref-overlay__label" }, "Version: "),
			span({ class: "pref-overlay__value" }, GM_info.script.version),
		]),
		div({ class: "pref-overlay__item" }, [
			span({ class: "pref-overlay__label" }, "[T] Toggle Bot: "),
			span(
				{ class: getToggleClass(botEnabledState) },
				getToggleValue(botEnabledState),
			),
		]),
		div({ class: "pref-overlay__item" }, [
			span({ class: "pref-overlay__label" }, "[V] Toggle Visualizer: "),
			span(
				{ class: getToggleClass(visualizeState) },
				getToggleValue(visualizeState),
			),
		]),
		div({ class: "pref-overlay__item" }, [
			span({ class: "pref-overlay__label" }, "[A] Collision Radius: "),
			span({ class: "pref-overlay__value" }, () => radiusMultState.val),
		]),
		div({ class: "pref-overlay__item" }, [
			span({ class: "pref-overlay__label" }, "[I] Auto Respawn: "),
			span(
				{ class: getToggleClass(autoRespawnState) },
				getToggleValue(autoRespawnState),
			),
		]),
		div({ class: "pref-overlay__item" }, [
			span({ class: "pref-overlay__label" }, "[G] God Mode Assist: "),
			span(
				{ class: getToggleClass(godModeEnabledState) },
				getToggleValue(godModeEnabledState),
			),
		]),
		div({ class: "pref-overlay__item" }, [
			span({ class: "pref-overlay__label" }, "[X] God Mode Visuals: "),
			span(
				{ class: getToggleClass(godModeVisualsState) },
				getToggleValue(godModeVisualsState),
			),
		]),
		div({ class: "pref-overlay__item" }, [
			span({ class: "pref-overlay__label" }, "[F] Toggle GFX: "),
			span(
				{ class: getToggleClass(gfxEnabledState) },
				getToggleValue(gfxEnabledState),
			),
		]),
		div({ class: "pref-overlay__item" }, [
			span({ class: "pref-overlay__label" }, "[Esc] Quick Respawn"),
		]),
		div({ class: "pref-overlay__item" }, [
			span({ class: "pref-overlay__label" }, "[Q] Quit Game"),
		]),
		div({ class: "pref-overlay__item" }, [
			span({ class: "pref-overlay__label" }, "[H] Toggle Overlay"),
		]),
		div({ class: "pref-overlay__item" }, [
			span({ class: "pref-overlay__label" }, "[Mouse Wheel] Zoom"),
		]),
		div({ class: "pref-overlay__item" }, [
			span({ class: "pref-overlay__label" }, "[N/M] Zoom In/Out"),
		]),
		div({ class: "pref-overlay__item" }, [
			span({ class: "pref-overlay__label" }, "[Z] Reset Zoom"),
		]),
	],
);

export const hudOverlay = div({ id: "hud-overlay" }, [
	div({ class: "hud-overlay__item" }, [
		span({ class: "hud-overlay__label" }, "FPS: "),
		span({ class: "hud-overlay__value" }, () => fpsState.val),
	]),
	div({ class: "hud-overlay__item" }, [
		span({ class: "hud-overlay__label" }, "Ping: "),
		span(
			{ class: "hud-overlay__value", style: "min-width: 3em;" },
			() => pingState.val,
		),
	]),
	div({ class: "hud-overlay__item" }, [
		span({ class: "hud-overlay__label" }, "IP: "),
		span({ class: "hud-overlay__value" }, () => serverState.val),
	]),
]);

ready().then(() => {
	add(document.body, prefOverlay, hudOverlay, gfxOverlay);
});
