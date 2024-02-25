"use strict";

const {ipcRenderer} = require("electron");
const stringify = require("./stringify");

let title = "";
let override = "";
let timeout_id = null;

exports.set_title = function(s) {
	s = stringify(s);
	if (s === title) {
		return;
	}
	title = s;
	if (override) {
		return;
	} else {
		ipcRenderer.send("set_title", title);
	}
};

exports.get_title = function() {
	return title;
};

exports.set_override = function(s, duration) {
	override = stringify(s);
	ipcRenderer.send("set_title", override);
	if (timeout_id) {
		console.log("yes");
		clearTimeout(timeout_id);
	}
	timeout_id = setTimeout(() => {
		timeout_id = null;
		override = "";
		ipcRenderer.send("set_title", title);
	}, duration);
};
