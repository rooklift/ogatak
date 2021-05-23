"use strict";

// Note: some "mouseenter" handlers are also created by the board drawer.

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

// Clicking on the boardinfo...

document.getElementById("boardinfo").addEventListener("mousedown", (event) => {
	let s = event_path_class_string(event, "boardinfo_");
	if ((s) === "rules") {
		hub.cycle_rules(event.which !== 1);
	}
	if ((s) === "komi") {
		hub.cycle_komi(event.which !== 1);
	}
	if ((s) === "numbers") {
		hub.cycle_numbers(event.which !== 1);
	}
});

// The mouse leaving the board may require a redraw...

document.getElementById("boardtable").addEventListener("mouseleave", (event) => {
	if (hub.maindrawer.last_draw_was_pv) {
		hub.maindrawer.draw_standard(hub.node);
	}
});

// Clicking on the graph should go to that position in the game...

document.getElementById("graphpositioncanvas").addEventListener("mousedown", (event) => {
	let node = hub.grapher.node_from_click(hub.node, event);
	hub.set_node(node);
});

document.getElementById("treecanvas").addEventListener("mousedown", (event) => {
	let node = hub.tree_drawer.node_from_click(hub.node, event);
	hub.set_node(node);
});

// Various keys have been observed to move scrollbars when we don't want them to, so intercept them...

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
	if (event.code === "Space") {
		event.preventDefault();
		hub.toggle_ponder();
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

ipcRenderer.on("set", (event, msg) => {
	hub.set(msg.key, msg.value);
});

ipcRenderer.on("toggle", (event, msg) => {
	hub.set(msg, !config[msg]);
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
