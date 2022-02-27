"use strict";

// Exports a function we use to draw alert messages.
// To be used in the main process only (so when the renderer needs to make an alert, it sends the message to main via IPC).

const electron = require("electron");
const stringify = require("./stringify");

let major_version = (process && process.versions) ? parseInt(process.versions.electron, 10) : 0;

if (Number.isNaN(major_version)) {
	major_version = 0;
}

let alerts_open = 0;

module.exports = function(msg) {

	if (alerts_open >= 3) {
		console.log(msg);
		return;
	}

	alerts_open++;

	if (major_version <= 5) {		// Old API. Providing a callback makes the window not block the process.
									// Best keep this compatibility with v5 so that we can alert the user to use v6!

		electron.dialog.showMessageBox({message: stringify(msg), title: "Alert", buttons: ["OK"]}, () => {
			alerts_open--;
		});

	} else {						// New promise-based API. Despite what older (pre-v12) docs say, I don't think this ever blocks.

		electron.dialog.showMessageBox({message: stringify(msg), title: "Alert", buttons: ["OK"]}).then(() => {
			alerts_open--;
		});

	}
};
