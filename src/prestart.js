"use strict";

if (!process || !process.versions || Number.isNaN(parseInt(process.versions.electron, 10)) || parseInt(process.versions.electron, 10) < 6) {
	throw new Error("Ogatak requires Electron 6 or higher.");		// Because we use some promise-based APIs that started in 6.0.0
}

const electron = require("electron");

if (!electron.app.requestSingleInstanceLock()) {
	console.log("Ogatak is apparently already running. Shutting down this instance.");
	electron.app.quit();
} else {
	require("./main");
}
