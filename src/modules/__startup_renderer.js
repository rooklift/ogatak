"use strict";

const {ipcRenderer} = require("electron");

const config_io = require("./config_io");
const stringify = require("./stringify");
const {event_path_class_string} = require("./utils");

config_io.load();
config_io.create_if_needed();

// ---------------------------------------------------------------------------------------------------
// Explicitly add only the globals we need...

global.alert = (msg) => {							// Do this first.
	ipcRenderer.send("alert", stringify(msg));
};

global.config = config_io.config;					// Do this second. e.g. because new_hub() uses it.
global.save_config = config_io.save;

global.hub = require("./hub").new_hub();

// ---------------------------------------------------------------------------------------------------

document.addEventListener("wheel", (event) => {

	let path = event.path || (event.composedPath && event.composedPath());

	if (path) {
		for (let item of path) {
			if (item.id === "tabdiv") {		// Can have a scrollbar.
				return;
			}
		}
	}

	if (event.deltaY && event.deltaY < 0) {
		hub.prev();
	}
	if (event.deltaY && event.deltaY > 0) {
		hub.next();
	}
});

document.getElementById("tabdiv").addEventListener("mousedown", (event) => {
	let i = event_path_class_string(event, "tab_");
	if (typeof i === "string") {
		hub.switch_tab(parseInt(i, 10));
	}
});

document.getElementById("boardtable").addEventListener("mousedown", (event) => {
	event.preventDefault();
	let s = event_path_class_string(event, "td_");
	if (s) {
		if (event.which === 2) {
			// we could make a new tab, but meh...
		} else {
			hub.try_move(s);
		}
	}
});

document.getElementById("boardtable").addEventListener("mouseleave", (event) => {
	hub.mouse_left_board();
});

document.getElementById("graphpositioncanvas").addEventListener("mousedown", (event) => {
	hub.graph_click(event);
});

window.addEventListener("dragenter", (event) => {		// Necessary to prevent brief flashes of "not allowed" icon.
	event.preventDefault();
});

window.addEventListener("dragover", (event) => {		// Necessary to prevent always having the "not allowed" icon.
	event.preventDefault();
});

window.addEventListener("drop", (event) => {
	event.preventDefault();
	hub.handle_drop(event);
});

window.addEventListener("resize", (event) => {
	hub.window_resize_time = performance.now();
});

window.addEventListener("error", (event) => {
	alert("An uncaught exception happened in the renderer process. See the dev console for details. The app might now be in a bad state.");
}, {once: true});

// ---------------------------------------------------------------------------------------------------

const search_changers = {		// All should be true, only keys matter.
	"rules": true,
	"widerootnoise": true,
};

ipcRenderer.on("set", (event, msg) => {
	config[msg.key] = msg.value;
	save_config();
	if (hub.engine.desired && search_changers[msg.key]) {
		hub.go();
	}
	hub.draw();
	hub.grapher.draw_graph(hub.node);
});

ipcRenderer.on("toggle", (event, msg) => {
	config[msg] = !config[msg];
	save_config();
	if (hub.engine.desired && search_changers[msg]) {
		hub.go();
	}
	hub.draw();
	hub.grapher.draw_graph(hub.node);
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

// ---------------------------------------------------------------------------------------------------

hub.draw();
hub.window_resize_checker();
hub.graph_draw_spinner();

ipcRenderer.send("renderer_ready", null);
