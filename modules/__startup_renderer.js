"use strict";

const {ipcRenderer} = require("electron");

const config_io = require("./config_io");
const stringify = require("./stringify");
const {event_path_class_string} = require("./utils");

config_io.load();
config_io.create_if_needed();

// ---------------------------------------------------------------------

global.alert = (msg) => {							// Set this first.
	ipcRenderer.send("alert", stringify(msg));
};

global.config = config_io.config;
global.hub = require("./hub").new_hub();

hub.draw();

// ---------------------------------------------------------------------

document.getElementById("boardtable").addEventListener("mousedown", (event) => {
	let coords = event_path_class_string(event, "td_");
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

// ---------------------------------------------------------------------

ipcRenderer.on("set", (event, msg) => {
	global.config[msg.key] = msg.value;
	config_io.save();
	hub.draw();
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

ipcRenderer.on("go", (event, msg) => {
	hub.go();
});

ipcRenderer.on("halt", (event, msg) => {
	hub.halt();
});
