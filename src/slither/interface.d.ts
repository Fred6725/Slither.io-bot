export interface IGameObject {
	xx: number;
	yy: number;
}

export interface IColor {
	rr: number;
	gg: number;
	bb: number;
}

export interface ISlitherPoint extends IGameObject {
	xx: number;
	yy: number;
	fx: number;
	fy: number;
	ebx: number;
	eby: number;
	da: number;
	dying: boolean;
}

export interface ISlither extends IGameObject, IColor {
	id: number;
	xx: number;
	yy: number;
	rcv: number;

	ehang: number;
	wehang: number;
	ang: number;
	eang: number;
	wang: number;

	pts: ISlitherPoint[];
	sct: number;
	fam: number;
	rsc: number;
	sc: number;

	scang: number;
	spang: number;

	dead: boolean;
	dead_amt: number;
	alive_amt: number;

	dir: number;
	edir: number;

	nk: string;
	na: number;

	rex: number;
	rey: number;

	sp: number;
	tsp: number;
	ssp: number;
	fsp: number;
	msp: number;

	ehl: number;
	msl: number;

	fxs: Float32Array;
	fys: Float32Array;
	fx: number;
	fy: number;
	fpos: number;
	ftg: number;

	fas: Float32Array;
	fapos: number;
	fatg: number;
	fa: number;

	fchls: Float32Array;
	fchl: number;
	chl: number;

	fls: Float32Array;
	flpos: number;
	fltg: number;
	fl: number;
	tl: number;
	cfl: number;

	sep: number;
	wsep: number;

	iiv: boolean;
}

export interface IFood extends IGameObject, IColor {
	id: number;
	xx: number;
	yy: number;
	cv: number;
	sz: number;
	eaten: boolean;
}

export interface IPrey extends IGameObject, IColor {
	id: number;
	xx: number;
	yy: number;
	cv: number;
	sz: number;
	eaten: boolean;
}

export interface IDeadpool<T> {
	os: T[];
	len: number;
	end_pos: number;
	add(o: T): void;
	get(): T | null;
}

export interface ISlitherPointDeadpool extends IDeadpool<ISlitherPoint> {}

export interface ITextButton {
	lic: number;
	elem: HTMLElement;
	md: boolean;
	mo: boolean;
	mdf: number;
	mof: number;
	ho: HTMLDivElement;
	alic(): void;
	setEnabled(e: boolean): void;
	normi: HTMLImageElement;
	upi: HTMLImageElement;
	downi: HTMLImageElement;
}

export interface IAbstractServer {
	ip: string;
	po: number;
	ac: number;
}

export interface ICluster {
	ps: WebSocket | null;
	ptms: number[];
	sis: { ip: string }[];
	sos: IOfficialServer[];
	stm: number;
	swg: number;
	tac: number;
}

export interface IOfficialServer extends IAbstractServer {
	ac: number;
	active: boolean;
	clu: number;
	cluo: ICluster[];
	ip: string;
	po: number;
	sid: number;
	wg: number;
}

export interface IPerColorImg {
	imgs: HTMLCanvasElement[];
	fws: number[];
	fhs: number[];
	fw2s: number[];
	fh2s: number[];
	gimgs: HTMLCanvasElement[];
	gfws: number[];
	gfhs: number[];
	gfw2s: number[];
	gfh2s: number[];
	oimgs: HTMLCanvasElement[];
	ofws: number[];
	ofhs: number[];
	ofw2s: number[];
	ofh2s: number[];
	cs: string;
	kfmc: HTMLCanvasElement;
	kmcs: HTMLCanvasElement[];
	kmos: unknown[];
	kl: number;
	klp: boolean;
	ic?: number;
	pr_imgs?: HTMLCanvasElement[];
	pr_fws?: number[];
	pr_fhs?: number[];
	pr_fw2s?: number[];
	pr_fh2s?: number[];
}
