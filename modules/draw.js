"use strict";

const {Background} = require("./background");
const {XYtoS} = require("./utils");

const black_stone = new Image(); black_stone.src = "./gfx/black_stone.png";
const white_stone = new Image(); white_stone.src = "./gfx/white_stone.png";
const ko_marker   = new Image(); ko_marker.src   = "./gfx/ko.png";

exports.NewBoardDrawer = function(backgrounddiv, htmltable) {

	let drawer = {};

	drawer.width = null;
	drawer.height = null;
	drawer.current = null;
	drawer.current_ko = null;

	drawer.backgrounddiv = backgrounddiv;
	drawer.htmltable = htmltable;

	drawer.Draw = function(node) {

		let board = node.get_board();

		if (this.width !== board.width || this.height !== board.height) {

			// Reset all the things.

			this.width = board.width;
			this.height = board.height;
			this.current = [];
			this.current_ko = null;

			this.htmltable.innerHTML = "";
			this.htmltable.style["background-image"] = Background(board.width, board.height, 32);

			for (let y = 0; y < board.height; y++) {
				let tr = document.createElement("tr");
				htmltable.appendChild(tr);
				for (let x = 0; x < board.width; x++) {
					let td = document.createElement("td");
					td.className = "td_" + XYtoS(x, y);
					td.width = 32;
					td.height = 32;
					tr.appendChild(td);
				}
			}

			for (let x = 0; x < board.width; x++) {
				this.current.push([]);
				for (let y = 0; y < board.height; y++) {
					this.current[x].push("");
				}
			}

			this.htmltable.style.width = (board.width * 32).toString() + "px";
			this.htmltable.style.height = (board.height * 32).toString() + "px";

			this.backgrounddiv.style.left = this.htmltable.offsetLeft.toString() + "px";
			this.backgrounddiv.style.top = this.htmltable.offsetTop.toString() + "px";
			this.backgrounddiv.style.width = (board.width * 32).toString() + "px";
			this.backgrounddiv.style.height = (board.height * 32).toString() + "px";
		}

		if (this.current_ko !== board.ko) {

			if (this.current_ko) {
				let x = this.current_ko.charCodeAt(0) - 97;
				let y = this.current_ko.charCodeAt(1) - 97;
				let td = this.htmltable.getElementsByClassName("td_" + XYtoS(x, y))[0];
				td.style["background-image"] = "";
				this.current[x][y] = "";
			}

			if (board.ko) {
				let x = board.ko.charCodeAt(0) - 97;
				let y = board.ko.charCodeAt(1) - 97;
				let td = this.htmltable.getElementsByClassName("td_" + XYtoS(x, y))[0];
				td.style["background-image"] = `url("${ko_marker.src}")`;
				this.current[x][y] = "";
			}

			this.current_ko = board.ko;
		}

		for (let x = 0; x < this.width; x++) {

			for (let y = 0; y < this.height; y++) {

				if (this.current[x][y] === board.state[x][y]) {
					continue;
				}

				let td = this.htmltable.getElementsByClassName("td_" + XYtoS(x, y))[0];

				if (board.state[x][y] === "b") {
					td.style["background-image"] = `url("${black_stone.src}")`;
				} else if (board.state[x][y] === "w") {
					td.style["background-image"] = `url("${white_stone.src}")`;
				} else {
					td.style["background-image"] = "";
				}

				this.current[x][y] = board.state[x][y]
			}
		}
	};

	return drawer;

};
