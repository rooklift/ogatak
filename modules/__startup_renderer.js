"use strict";

const {ipcRenderer} = require("electron");

const config_io = require("./config_io");
const Stringify = require("./stringify");
const {EventPathClassString} = require("./utils");

config_io.load();
config_io.create_if_needed();

// ---------------------------------------------------------------------

global.config = config_io.config;
global.hub = require("./hub").NewHub();

global.alert = (msg) => {
	ipcRenderer.send("alert", Stringify(msg));
};

hub.draw();

// ---------------------------------------------------------------------

const boardbg = document.getElementById("boardbg");
const boardtable = document.getElementById("boardtable");

boardtable.addEventListener("mousedown", (event) => {
	let coords = EventPathClassString(event, "td_");
	if (coords) {
		hub.try_move(coords);
	}
});

document.addEventListener("wheel", (event) => {
	let allow = false;
	let path = event.path || (event.composedPath && event.composedPath());
	if (path) {
		for (let item of path) {
			if (item.id === "boardtable") {
				allow = true;
				break;
			}
		}
	}
	if (allow && event.deltaY && event.deltaY < 0) {
		hub.prev();
	}
	if (allow && event.deltaY && event.deltaY > 0) {
		hub.next();
	}
});

ipcRenderer.on("load", (event, msg) => {
	hub.load(msg);
});

ipcRenderer.on("go_to_end", (event, msg) => {
	hub.go_to_end();
});

ipcRenderer.on("go_to_root", (event, msg) => {
	hub.go_to_root();
});

ipcRenderer.on("prev", (event, msg) => {
	hub.prev();
});

ipcRenderer.on("next", (event, msg) => {
	hub.next();
});

ipcRenderer.on("return_to_main", (event, msg) => {
	hub.return_to_main();
});

ipcRenderer.on("prev_sibling", (event, msg) => {
	hub.prev_sibling();
});

ipcRenderer.on("next_sibling", (event, msg) => {
	hub.next_sibling();
});
