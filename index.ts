import esbuild from "esbuild";

const header = `/*
The MIT License (MIT)
 Copyright (c) 2025 saya <saya.38slither@gmail.com>
 Copyright (c) 2016 Jesse Miller <jmiller@jmiller.com>
 Copyright (c) 2016 Alexey Korepanov <kaikaikai@yandex.ru>
 Copyright (c) 2016 Ermiya Eskandary & Theophile Cailliau and other contributors
 https://jmiller.mit-license.org/
*/
// ==UserScript==
// @name         Slither.io Bot Championship Edition
// @namespace    https://github.com/saya-0x0efe/Slither.io-bot
// @version      4.0.0
// @description  Slither.io Bot Championship Edition
// @author       saya
// @match        http://slither.io
// @match        http://slither.com/*
// @grant        none
// ==/UserScript==
`;

esbuild
	.build({
		entryPoints: ["src/index.ts"],
		bundle: true,
		minify: false,
		format: "iife",
		outfile: "userscript/bot.user.js",
		platform: "browser",
		target: ["esnext"],
		banner: { js: header },
		loader: { ".css": "text" },
	})
	.catch(() => {
		process.exit(1);
	});

