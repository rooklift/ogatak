"use strict";

const {ipcRenderer} = require("electron");
const stringify = require("./stringify");



let title = "";

exports.set_title = function(s) {

	s = stringify(s);

	if (s === title) {
		return;
	}

	ipcRenderer.send("set_title", s);
	title = s;
};

exports.get_title = function() {
	return title;
};
