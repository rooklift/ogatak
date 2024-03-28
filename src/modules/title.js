"use strict";

const {ipcRenderer} = require("electron");
const stringify = require("./stringify");

let title = "";
let override_stopper_id = null;		// When overriding the title temporarily, this setTimeout will clear it.

exports.set_title = function(s) {
	s = stringify(s);
	if (s === title) {
		return;
	}
	title = s;
	if (override_stopper_id) {
		return;
	} else {
		ipcRenderer.send("set_title", title);
	}
};

exports.get_title = function() {
	return title;
};

exports.set_override = function(s, duration) {
	s = stringify(s);
	ipcRenderer.send("set_title", s);
	if (override_stopper_id) {
		clearTimeout(override_stopper_id);
	}
	override_stopper_id = setTimeout(() => {
		override_stopper_id = null;
		ipcRenderer.send("set_title", title);
	}, duration);
};
