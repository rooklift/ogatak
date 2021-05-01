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

ipcRenderer.on("call", (event, msg) => {
	let fn;
	if (typeof msg === "string") {																		// msg is function name
		fn = hub[msg].bind(hub);
	} else if (typeof msg === "object" && typeof msg.fn === "string" && Array.isArray(msg.args)) {		// msg is object with fn and args
		fn = hub[msg.fn].bind(hub, ...msg.args);
	} else {
		console.log("Bad call, msg was...");
		console.log(msg);
	}
	fn();
});
