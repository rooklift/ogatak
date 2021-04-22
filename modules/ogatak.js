"use strict";

const config_io = require("./config_io");
config_io.load();
config_io.create_if_needed();
const config = config_io.config;

// ---------------------------------------------------------------------

const DrawTable = require("./draw").DrawTable;
const EventPathString = require("./utils").EventPathString;
const NewBoard = require("./board").NewBoard;

const boardtable = document.getElementById("boardtable");

// ---------------------------------------------------------------------

let board = NewBoard(19, 19);
DrawTable(board);

boardtable.addEventListener("mousedown", (event) => {
	let coords = EventPathString(event, "td_");
	if (coords) {
		board.play(coords);
		DrawTable(board);
	}
});
