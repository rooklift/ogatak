"use strict";

const XYtoS = require("./utils").XYtoS;

const boardtable = document.getElementById("boardtable");

const black_stone = new Image();
const white_stone = new Image();
black_stone.src = "./gfx/black_stone.png";
white_stone.src = "./gfx/white_stone.png";

let width = null;
let height = null;
let current = null;

exports.DrawTable = function(board) {

	if (width !== board.width || height !== board.height) {

		width = board.width;
		height = board.height;
		current = [];

		boardtable.innerHTML = "";

		for (let y = 0; y < height; y++) {
			let tr = document.createElement("tr");
			boardtable.appendChild(tr);
			for (let x = 0; x < width; x++) {
				let td = document.createElement("td");
				td.id = "td_" + XYtoS(x, y);
				td.width = 32;
				td.height = 32;
				tr.appendChild(td);
			}
		}

		for (let x = 0; x < width; x++) {
			current.push([]);
			for (let y = 0; y < height; y++) {
				current[x].push("");
			}
		}

	}

	for (let x = 0; x < width; x++) {

		for (let y = 0; y < height; y++) {

			if (current[x][y] === board.state[x][y]) {
				continue;
			}

			let td = document.getElementById("td_" + XYtoS(x, y));

			if (board.state[x][y] === "b") {
				td.style["background-image"] = `url("${black_stone.src}")`;
			} else if (board.state[x][y] === "w") {
				td.style["background-image"] = `url("${white_stone.src}")`;
			} else {
				td.style["background-image"] = "";
			}

			current[x][y] = board.state[x][y]
		}
	}
};
