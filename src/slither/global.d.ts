import type {
	IAbstractServer,
	IFood,
	IOfficialServer,
	IPerColorImg,
	IPrey,
	ISlither,
	ISlitherPoint,
	ITextButton,
} from "./interface";

// Purpose: Define global variables and functions for the slither.io game.
export declare global {
	declare function newSlither(
		id: number,
		xx: number,
		yy: number,
		cv: number,
		ang: number,
		pts: ISlitherPoint[],
		msl: number,
		custom_skin_uint8: Uint8Array,
	): ISlither;
	declare function newFood(
		id: number,
		xx: number,
		yy: number,
		rad: number,
		rapid: boolean,
		cv: number,
	): IFood;
	declare function newPrey(
		id: number,
		xx: number,
		yy: number,
		rad: number,
		cv: number,
		dir: number,
		wang: number,
		ang: number,
		speed: number,
	): IPrey;
	declare function setAcceleration(mode: number): void;
	declare function resetGame(): void;
	declare function connect(): void;

	declare var timeObj: DateConstructor | Performance;

	declare var animating: boolean;

	declare var sos: IOfficialServer[];
	declare var bso: IAbstractServer;

	declare var lgbsc: number;
	declare var lgcsc: number;
	declare var lb_fr: number;
	declare var login_fr: number;
	declare var llgmtm: number;
	declare var login_iv: number;
	declare var play_count: number;
	declare var want_play: boolean;

	declare var play_btn: ITextButton;

	declare var mww: number;
	declare var mhh: number;
	declare var mwwp50: number;
	declare var mhhp50: number;
	declare var mwwp150: number;
	declare var mhhp150: number;
	declare var mww2: number;
	declare var mhh2: number;
	declare var mc: HTMLCanvasElement;

	declare var sgsc: number;
	declare var gsc: number;

	declare var grd: number;
	declare var flux_grd: number;
	declare var real_flux_grd: number;
	declare var flxc: number;
	declare var flxas: number[];
	declare var flx_tg: number;
	declare var flux_grds: number[];
	declare var flux_grd_pos: number;

	declare var render_mode: number;

	declare var cm1: number;
	declare var slithers: ISlither[];
	declare var foods: IFood[];
	declare var foods_c: number;
	declare var preys: IFood[];
	declare var os: Record<`s${number}`, ISlither>;

	declare var spangdv: number;
	declare var nsp1: number;
	declare var nsp2: number;
	declare var nsp3: number;
	declare var mamu: number;
	declare var mamu2: number;
	declare var cst: number;
	declare var default_msl: number;

	declare var per_color_imgs: IPerColorImg[];
	declare var rrs: number[];
	declare var ggs: number[];
	declare var bbs: number[];

	declare var view_xx: number;
	declare var view_yy: number;
	declare var view_ang: number;
	declare var view_dist: number;
	declare var fvx: number;
	declare var fvy: number;
	declare var xm: number;
	declare var ym: number;
	declare var lsxm: number;
	declare var lsym: number;
	declare var slither: ISlither | null;

	declare var fr: number;
	declare var lfr: number;
	declare var ltm: number;
	declare var vfr: number;
	declare var vfrb: number;
	declare var avfr: number;
	declare var afr: number;
	declare var fr2: number;
	declare var lfr2: number;
	declare var vfrb2: number;
	declare var cptm: number;
	declare var lptm: number;
	declare var lpstm: number;
	declare var last_ping_mtm: number;
	declare var want_etm_s: boolean;
	declare var want_seq: boolean;
	declare var lseq: number;
	declare var lagging: boolean;
	declare var lag_mult: number;
	declare var wfpr: boolean;
	declare var high_quality: boolean;
	declare var gla: number;
	declare var wdfg: number;
	declare var qsm: number;
	declare var mqsm: number;
	declare var playing: boolean;
	declare var connected: boolean;

	declare var dead_mtm: number;
	declare var at2lt: Float32Array;

	declare function oef(): void;

	declare var fps: number;
	declare function redraw(): void;

	declare var ww: number;
	declare var hh: number;
	declare var lww: number;
	declare var lhh: number;
	declare var hsu: number;
	declare var csc: number;

	declare var mscps: number;
	declare var fmlts: number[];
	declare var fpsls: number[];
	declare var ws: WebSocket | null;

	declare var lrd_mtm: number;
	declare var locu_mtm: number;

	declare var protocol_version: number;
	declare var connecting: boolean;

	declare var choosing_skin: boolean;
	declare var building_skin: boolean;
	declare var ending_build_skin: boolean;

	declare var selecting_cosmetic: boolean;
	declare var ending_select_cosmetic: boolean;

	////
	declare var gotPacket: (a: Uint8Array) => void;
	declare function forceServer(a: string, b: number): void;
}

export declare global {
	// @ts-ignore
	// biome-ignore lint/suspicious/noExplicitAny: GM is GreaseMonkey API object
	var GM_info: any;
}
