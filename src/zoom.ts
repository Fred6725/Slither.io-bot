export class Zoom {
	#MIN = 0.08;
	#MAX = 30;

	#desired_gsc = 0;

	adjust(dir: number) {
		const scale = this.#desired_gsc * 0.9 ** dir;
		this.#desired_gsc = Math.max(this.#MIN, Math.min(this.#MAX, scale));
	}

	get() {
		return this.#desired_gsc;
	}

	set(scale: number) {
		this.#desired_gsc = scale;
	}
}
