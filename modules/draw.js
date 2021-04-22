"use strict";

const XYtoS = require("./utils").XYtoS;
const Background = require("./background").Background;

const boardbg = document.getElementById("boardbg");
const boardtable = document.getElementById("boardtable");

const black_stone = new Image();
const white_stone = new Image();
const ko_marker = new Image();
black_stone.src = "./gfx/black_stone.png";
white_stone.src = "./gfx/white_stone.png";
ko_marker.src = "./gfx/ko.png";

let width = null;
let height = null;
let current = null;
let current_ko = null;

exports.DrawTable = function(board) {

	if (width !== board.width || height !== board.height) {

		width = board.width;
		height = board.height;
		current = [];
		current_ko = null;

		boardtable.innerHTML = "";
		boardtable.style["background-image"] = Background(board.width, board.height, 32);

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

		boardtable.style.width = (board.width * 32).toString() + "px";
		boardtable.style.height = (board.height * 32).toString() + "px";

		boardbg.style.left = boardtable.offsetLeft.toString() + "px";
		boardbg.style.top = boardtable.offsetTop.toString() + "px";
		boardbg.style.width = (board.width * 32).toString() + "px";
		boardbg.style.height = (board.height * 32).toString() + "px";
	}

	if (current_ko !== board.ko) {

		if (current_ko) {
			let x = current_ko.charCodeAt(0) - 97;
			let y = current_ko.charCodeAt(1) - 97;
			let td = document.getElementById("td_" + XYtoS(x, y));
			td.style["background-image"] = "";
			current[x][y] = "";
		}

		if (board.ko) {
			let x = board.ko.charCodeAt(0) - 97;
			let y = board.ko.charCodeAt(1) - 97;
			let td = document.getElementById("td_" + XYtoS(x, y));
			td.style["background-image"] = `url("${ko_marker.src}")`;
			current[x][y] = "";
		}

		current_ko = board.ko;
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
