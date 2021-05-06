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
	if (event.deltaY && event.deltaY < 0) {
		hub.prev();
	}
	if (event.deltaY && event.deltaY > 0) {
		hub.next();
	}
});

document.getElementById("boardtable").addEventListener("mousedown", (event) => {
	let coords = event_path_class_string(event, "td_");
	if (coords) {
		hub.try_move(coords);
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
});

// ---------------------------------------------------------------------------------------------------

ipcRenderer.on("set", (event, msg) => {
	config[msg.key] = msg.value;
	save_config();
	hub.draw();
});

ipcRenderer.on("toggle", (event, msg) => {
	config[msg] = !config[msg];
	save_config();
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

// ---------------------------------------------------------------------------------------------------

hub.draw();
hub.window_resize_checker();
hub.graph_draw_spinner();

ipcRenderer.send("renderer_ready", null);
