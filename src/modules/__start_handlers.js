"use strict";

// Note: some "mouseenter" handlers are also created by the board drawer.

const {ipcRenderer} = require("electron");
const {event_path_class_string} = require("./utils");

// Wheel should scroll the current game...

document.addEventListener("wheel", (event) => {

	if (!event.deltaY) {
		return;
	}

	let path = event.path || (event.composedPath && event.composedPath());

	// 2 items can have scrollbars. If they do, the mouse wheel should not be used to scroll the game...

	if (Array.isArray(path) && path.some(item => item.id === "tabdiv")) {
		if (tabber.outer_div.scrollHeight > tabber.outer_div.clientHeight) {
			return;
		}
	}

	if (Array.isArray(path) && path.some(item => item.id === "comments")) {
		if (comment_drawer.div.scrollHeight > comment_drawer.div.clientHeight) {
			return;
		}
	}

	if (event.deltaY < 0) hub.input_up_down(-1);
	if (event.deltaY > 0) hub.input_up_down(1);
});

// Clicking a tab should switch tabs...

document.getElementById("tabdiv").addEventListener("mousedown", (event) => {
	event.preventDefault();
	let i = event_path_class_string(event, "tab_");
	if (typeof i === "string") {
		hub.switch_tab_by_dom_id("tab_" + i);
	}
});

// Clicking on the board...

document.getElementById("boardtable").addEventListener("mousedown", (event) => {
	event.preventDefault();
	let s = event_path_class_string(event, "td_");
	if (s) {
		hub.click(s);
	}
});

// Clicking on the boardinfo...

document.getElementById("boardinfo").addEventListener("mousedown", (event) => {
	event.preventDefault();
	let s = event_path_class_string(event, "boardinfo_");
	if (s === "rules") {
		hub.cycle_rules(event.which !== 1);
	} else if (s === "komi") {
		hub.cycle_komi(event.which !== 1);
	} else if (s === "numbers") {
		hub.cycle_numbers(event.which !== 1);
	} else if (s === "mode") {
		hub.cycle_mode(event.which !== 1);
	} else if (s === "active") {
		hub.toggle_active_player();
	}
});

// The mouse leaving the board may require a redraw...

document.getElementById("boardtable").addEventListener("mouseleave", (event) => {
	if (board_drawer.pv) {
		board_drawer.draw_standard(hub.node);
	}
});

// Clicking on the graph should go to that position in the game...

document.getElementById("graphpositioncanvas").addEventListener("mousedown", (event) => {
	event.preventDefault();
	let node = grapher.node_from_click(hub.node, event);
	if (node) {
		hub.set_node(node, {bless: false});
	}
});

// Clicking on the tree should go to that position in the game...

document.getElementById("treecanvas").addEventListener("mousedown", (event) => {
	event.preventDefault();
	let node = tree_drawer.node_from_click(hub.node, event);
	if (node) {
		hub.set_node(node, {bless: true});
	}
});

// Clicking on the fullbox should close it...

document.getElementById("fbox").addEventListener("mousedown", (event) => {
	event.preventDefault();
	fullbox.hide();
});

// Comments instantly update the node... thankfully this does not fire when our code itself changes the value...

document.getElementById("comments").addEventListener("input", (event) => {
	hub.commit_comment();
});

// Prevent stray middle-clicks entering "scroll" mode...
// Also, any click outside the comments should defocus the comments...

document.getElementById("gridder").addEventListener("mousedown", (event) => {
	if (event.which === 2) {
		event.preventDefault();
	}
	let path = event.path || (event.composedPath && event.composedPath());
	if (path) {
		if (!path.some(item => item.id === "comments")) {
			comment_drawer.div.blur();
		}
	}
});

// Various keys have been observed to move scrollbars when we don't want them to, so intercept them...
//
// Also, Space and Comma are nominally accelerators in main.js but actually intercepted here because
// they have different behaviour if the comments box is in focus...

window.addEventListener("keydown", (event) => {
	if (event.code === "PageUp") {
		event.preventDefault();
		hub.input_up_down(-10);
	} else if (event.code === "PageDown") {
		event.preventDefault();
		hub.input_up_down(10);
	} else if (event.code === "Home") {
		event.preventDefault();
		hub.go_to_root();
	} else if (event.code === "End") {
		event.preventDefault();
		hub.go_to_end();
	} else if (event.code === "ArrowUp") {
		event.preventDefault();
		hub.input_up_down(-1);
	} else if (event.code === "ArrowDown") {
		event.preventDefault();
		hub.input_up_down(1);

	} else if (event.code === "Space") {
		event.preventDefault();
		if (comment_drawer.div.matches(":focus")) {
			insert_into_comments(" ");
		} else {
			hub.toggle_ponder();
		}
	} else if (event.code === "Comma") {
		event.preventDefault();
		if (comment_drawer.div.matches(":focus")) {
			insert_into_comments(",");
		} else {
			hub.play_best();
		}
	}
});

function insert_into_comments(s) {
	let i = comment_drawer.div.selectionStart;
	let j = comment_drawer.div.selectionEnd;
	comment_drawer.div.value = comment_drawer.div.value.slice(0, i) + s + comment_drawer.div.value.slice(j);
	comment_drawer.div.selectionStart = i + 1;
	comment_drawer.div.selectionEnd = i + 1;
	hub.commit_comment();								// Our "input" event handler only handles user-made changes.
}

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

// Uncaught exceptions should trigger an alert (once only)...

window.addEventListener("error", (event) => {
	alert("An uncaught exception happened in the renderer process. See the dev console for details. The app might now be in a bad state.");
}, {once: true});

// ------------------------------------------------------------------------------------------------

ipcRenderer.on("set", (event, msg) => {
	for (let [key, value] of Object.entries(msg)) {
		hub.set(key, value);
	}
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
