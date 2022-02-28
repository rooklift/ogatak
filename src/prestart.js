"use strict";

if (!process || !process.versions || Number.isNaN(parseInt(process.versions.electron, 10)) || parseInt(process.versions.electron, 10) < 6) {
	throw new Error("Ogatak requires Electron 6 or higher.");		// Why? I forget.
}

const electron = require("electron");

if (!electron.app.requestSingleInstanceLock()) {
	electron.app.quit();
} else {
	require("./main");
}
