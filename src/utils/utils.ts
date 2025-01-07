export const ready = () =>
	new Promise<void>((resolve) => {
		const t = () => resolve();

		if ("loading" !== document.readyState) {
			queueMicrotask(t);
		} else {
			document.addEventListener("DOMContentLoaded", t);
		}
	});

export const appendCss = (css: string) => {
	const style = document.createElement("style");
	style.textContent = css;
	document.head.appendChild(style);
};
