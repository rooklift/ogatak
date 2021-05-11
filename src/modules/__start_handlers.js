"use strict";

const {ipcRenderer} = require("electron");
const {event_path_class_string} = require("./utils");

// Wheel should scroll the current game...

document.addEventListener("wheel", (event) => {
	let path = event.path || (event.composedPath && event.composedPath());
	if (path) {
		for (let item of path) {
			if (item.id === "tabdiv") {		// Can have a scrollbar.
				return;
			}
		}
	}
	if (event.deltaY) {
		if (event.deltaY < 0) hub.prev();
		if (event.deltaY > 0) hub.next();
	}
});

// Clicking a tab should switch tabs...

document.getElementById("tabdiv").addEventListener("mousedown", (event) => {
	let i = event_path_class_string(event, "tab_");
	if (typeof i === "string") {
		hub.switch_tab(parseInt(i, 10));
	}
});

// Clicking on the board should make a move...

document.getElementById("boardtable").addEventListener("mousedown", (event) => {
	event.preventDefault();
	let s = event_path_class_string(event, "td_");
	if (s) {
		if (event.which === 2) {
			hub.new_active_view_from_move(s);
		} else {
			hub.try_move(s);
		}
	}
});

// The mouse leaving the board may require a redraw...

document.getElementById("boardtable").addEventListener("mouseleave", (event) => {
	if (hub.maindrawer.last_draw_was_pv) {
		hub.maindrawer.draw_standard(hub.node);
	}
});

// Clicking on the graph should go to that position in the game...

document.getElementById("graphcanvas").addEventListener("mousedown", (event) => {
	let node = hub.grapher.node_from_click(hub.node, event);
	hub.set_node(node);
});

// Pressing arrows or Home or End should NOT affect the tabs list, but rather move about in the current game...

window.addEventListener("keydown", function(event) {
	if (event.code === "Home") {
		event.preventDefault();
		hub.go_to_root();
	}
	if (event.code === "End") {
		event.preventDefault();
		hub.go_to_end();
	}
	if (event.code === "ArrowUp") {
		event.preventDefault();
		hub.prev();
	}
	if (event.code === "ArrowDown") {
		event.preventDefault();
		hub.next();
	}
});

// Dragging files onto the window should load them...

window.addEventListener("dragenter", (event) => {		// Necessary to prevent brief flashes of "not allowed" icon.
	event.preventDefault();
});

window.addEventListener("dragover", (event) => {		// Necessary to prevent always having the "not allowed" icon.
	event.preventDefault();
});

window.addEventListener("drop", (event) => {
	event.preventDefault();
	let files = [];
	if (event.dataTransfer && event.dataTransfer.files) {
		for (let file of event.dataTransfer.files) {
			if (file.path) {
				files.push(file.path);
			}
		}
	}
	if (files.length > 0) {
		hub.load_multifile(files);
	}
});

// Resizing the screen should eventually cause the new sizes to be saved into the config...

window.addEventListener("resize", (event) => {
	hub.window_resize_time = performance.now();
});

// Uncaught exceptions should trigger an alert (once only)...

window.addEventListener("error", (event) => {
	alert("An uncaught exception happened in the renderer process. See the dev console for details. The app might now be in a bad state.");
}, {once: true});

// ------------------------------------------------------------------------------------------------

const search_changers = ["rules", "widerootnoise"];

ipcRenderer.on("set", (event, msg) => {
	config[msg.key] = msg.value;
	save_config();
	if (hub.engine.desired && search_changers.includes(msg.key)) {
		hub.go();
	}
	hub.draw();
	hub.grapher.draw_graph(hub.node);
});

ipcRenderer.on("toggle", (event, msg) => {
	config[msg] = !config[msg];
	save_config();
	if (hub.engine.desired && search_changers.includes(msg)) {
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
