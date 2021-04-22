"use strict";

const config_io = require("./config_io");
config_io.load();
config_io.create_if_needed();
const config = config_io.config;

// ---------------------------------------------------------------------

const DrawTable = require("./draw").DrawTable;
const EventPathString = require("./utils").EventPathString;
const NewNode = require("./node").NewNode;

const boardtable = document.getElementById("boardtable");

// ---------------------------------------------------------------------

let node = NewNode();
DrawTable(node.get_board());

boardtable.addEventListener("mousedown", (event) => {
	let coords = EventPathString(event, "td_");
	if (coords) {
		node = node.try_move(coords);
		DrawTable(node.get_board());
	}
});

exports.get_node = () => node;

