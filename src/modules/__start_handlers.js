"use strict";

// Note 1: some "mouseenter" handlers are also created by the board drawer.
//
// Note 2: some "input" handlers are also created by the root editor.
//
// Note 3: about event propagation:
//
// Events start at the innermost (deepest nested) element possible and bubble up to their containers.
// Each element in this process can potentially react, if it has a relevant EventListener.
// The bubbling process can be prevented with stopPropagation().
//
// Some events cause the browser to do something. In Electron, this includes activating menu accelerators.
// All the "browser actions" can be prevented with preventDefault().
//
// These two concepts are basically independent of each other.
// At least, all of this is my possibly-flawed understanding.

const {ipcRenderer} = require("electron");
const {event_path_class_string} = require("./utils");

// Wheel should scroll the current game...

window.addEventListener("wheel", (event) => {

	if (!event.deltaY) {
		return;
	}

	let path = event.path || (event.composedPath && event.composedPath());

	if (Array.isArray(path)) {
		for (let element of [tabber.outer_div, comment_drawer.textarea]) {		// 2 items can have scrollbars.
			if (element.scrollHeight > element.clientHeight) {					// If they do, the mouse wheel should not be used to scroll the game.
				if (path.some(item => item === element)) {						// Only if the mouse is actually over them, though.
					return;
				}
			}
		}
	}

	if (event.deltaY < 0) hub.input_up_down(-1);
	if (event.deltaY > 0) hub.input_up_down(1);
});

// Clicking a tab should switch tabs...

tabber.outer_div.addEventListener("mousedown", (event) => {
	event.preventDefault();
	let i = event_path_class_string(event, "tab_");
	if (typeof i === "string") {
		hub.switch_tab_by_dom_id("tab_" + i);
	}
});

// Clicking on the board...

board_drawer.htmltable.addEventListener("mousedown", (event) => {
	event.preventDefault();
	let s = event_path_class_string(event, "td_");
	if (s) {
		hub.click(s, event);
	}
});

// Clicking on the boardinfo...

board_drawer.infodiv.addEventListener("mousedown", (event) => {
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

board_drawer.htmltable.addEventListener("mouseleave", (event) => {
	if (board_drawer.pv) {
		board_drawer.draw_standard(hub.node);
	}
});

// Clicking on the graph should go to that position in the game... and dragging should also work...

grapher.positioncanvas.addEventListener("mousedown", (event) => {
	event.preventDefault();
	let node = grapher.node_from_click(hub.node, event);
	if (node) {
		hub.set_node(node, {bless: false});
	}
	grapher.dragging = true;												// Allow the dragging of the position to happen.
});

grapher.positioncanvas.addEventListener("mousemove", (event) => {
	if (grapher.dragging) {
		if (event.buttons) {
			grapher.pending_mousemove_y = event.offsetY;					// See the related spinner that actually changes the position.
		} else {
			grapher.dragging = false;
		}
	}
});

window.addEventListener("mouseup", (event) => {
	grapher.dragging = false;
});

// Clicking on the tree should go to that position in the game...

tree_drawer.canvas.addEventListener("mousedown", (event) => {
	event.preventDefault();
	let node = tree_drawer.node_from_click(hub.node, event);
	if (node) {
		hub.set_node(node, {bless: true});
	}
});

// Clicking on the fullbox should close it...

fullbox.outer_div.addEventListener("mousedown", (event) => {
	event.preventDefault();
	fullbox.hide();
});

// Comments instantly update the node... thankfully this does not fire when our code itself changes the value...

comment_drawer.textarea.addEventListener("input", (event) => {
	hub.commit_comment();
});

// Prevent stray middle-clicks entering "scroll" mode...
// Also, any click outside the comments should defocus the comments...

window.addEventListener("mousedown", (event) => {
	if (event.which === 2) {
		event.preventDefault();
	}
	let path = event.path || (event.composedPath && event.composedPath());
	if (path) {
		if (!path.some(item => item === comment_drawer.textarea)) {
			comment_drawer.textarea.blur();
		}
	}
});

// Various keys have been observed to move scrollbars when we don't want them to, so intercept them...

window.addEventListener("keydown", (event) => {

	// In each of these cases, the preventDefault() is there to prevent the unintended scrolling, but has the unwanted
	// side-effect of also stopping the menu accelerators from working. So we have to take the right action.

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

	// Tab is annoying, especially if the comments box is "hidden" -- which at the time of writing really means that the tree
	// is big enough that the comments are pushed offscreen. They are still there for tab to go to.

	} else if (event.code === "Tab") {
		event.preventDefault();

	// Our motivation for having "Space" here is twofold - it DOES cause undesired scrolling, but also:
	//
	// 1. We want "Space" to be shown as an accelerator in the menu, so it's there in main.js.
	// 2. But when the spacebar is pressed in the comment_drawer, we can't call preventDefault().
	// 3. So the accelerator will trigger in main.js, which we don't want.
	// 4. Through some chicanery, main.js can distinguish between menu-clicks and accelerator-keypresses, and ignore the latter.
	// 5. But there's no way (?) for it to know whether the accelerator was caused by a keypress in the comments or elsewhere.
	// 6. So main.js just has to ignore all spacebar keypresses.
	// 7. Which means we have to handle them entirely on the renderer side, i.e. calling toggle_ponder().
	// 8. So even if there was no scrolling issue, this would still be needed.

	} else if (event.code === "Space") {
		event.preventDefault();
		hub.toggle_ponder();
	}

});

// Space events shouldn't be handled by the above if they're on the comments box, or the root editor...

comment_drawer.textarea.addEventListener("keydown", (event) => {
	if (event.code === "Space") {
		event.stopPropagation();						// Stops it reaching the handler set on the window, above, which would call toggle_ponder().
	}													// We don't call preventDefault() since that prevents the edit the textarea.
});

root_editor.inner_div.addEventListener("keydown", (event) => {
	if (event.code === "Space") {
		event.stopPropagation();
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
