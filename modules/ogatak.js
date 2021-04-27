"use strict";

const config_io = require("./config_io");
config_io.load();
config_io.create_if_needed();
const config = config_io.config;

// ---------------------------------------------------------------------

const NewBoardDrawer = require("./draw").NewBoardDrawer;
const EventPathString = require("./utils").EventPathString;
const EventPathClassString = require("./utils").EventPathClassString;
const NewNode = require("./node").NewNode;

// ---------------------------------------------------------------------

const boardbg = document.getElementById("boardbg");
const boardtable = document.getElementById("boardtable");

// ---------------------------------------------------------------------

let node = NewNode();
window.debug_node = () => node;

let maindrawer = NewBoardDrawer(boardbg, boardtable);
maindrawer.Draw(node);

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

