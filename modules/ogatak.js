"use strict";

const config_io = require("./config_io");
config_io.load();
config_io.create_if_needed();
const config = config_io.config;

// ---------------------------------------------------------------------

const EventPathString = require("./utils").EventPathString;
const EventPathClassString = require("./utils").EventPathClassString;
const fs = require("fs");
const ipcRenderer = require("electron").ipcRenderer;
const NewBoardDrawer = require("./draw").NewBoardDrawer;
const NewNode = require("./node").NewNode;
const sgf = require("./sgf");

// ---------------------------------------------------------------------

const boardbg = document.getElementById("boardbg");
const boardtable = document.getElementById("boardtable");

// ---------------------------------------------------------------------

let node = NewNode();
window.debug_node = () => node;

let maindrawer = NewBoardDrawer(boardbg, boardtable);
maindrawer.Draw(node);

// ---------------------------------------------------------------------

boardtable.addEventListener("mousedown", (event) => {
	let coords = EventPathClassString(event, "td_");
	if (coords) {
		node = node.try_move(coords);
		maindrawer.Draw(node);
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
	if (allow && event.deltaY && event.deltaY < 0 && node.parent) {
		node = node.parent;
		maindrawer.Draw(node);
	}
	if (allow && event.deltaY && event.deltaY > 0 && node.children.length > 0) {
		node = node.children[0];
		maindrawer.Draw(node);
	}
});

// ---------------------------------------------------------------------

ipcRenderer.on("load", (event, msg) => {
	try {
		let s = fs.readFileSync(msg);
		node = sgf.Load(s, 0, null)[0];
		maindrawer.Draw(node);
	} catch (err) {
		console.log(err.toString());
	}
});

ipcRenderer.on("go_to_end", (event, msg) => {
	while (node.children.length > 0) {
		node = node.children[0];
	}
	maindrawer.Draw(node);
});

ipcRenderer.on("go_to_root", (event, msg) => {
	while (node.parent) {
		node = node.parent;
	}
	maindrawer.Draw(node);
});

ipcRenderer.on("prev", (event, msg) => {
	if (node.parent) {
		node = node.parent;
		maindrawer.Draw(node);
	}
});

ipcRenderer.on("next", (event, msg) => {
	if (node.children.length > 0) {
		node = node.children[0];
		maindrawer.Draw(node);
	}
});

ipcRenderer.on("next_sibling", (event, msg) => {
	if (node.parent && node.parent.children.length > 1) {
		let nexti = 0;
		for (let i = 0; i < node.parent.children.length; i++) {
			if (node.parent.children[i] === node) {
				nexti = i + 1;
				if (nexti >= node.parent.children.length) {
					nexti = 0;
				}
			}
		}

		node = node.parent.children[nexti];
		maindrawer.Draw(node);
	}
});
