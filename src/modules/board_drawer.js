"use strict";

const background = require("./background");
const {xy_to_s} = require("./utils");
const {node_id_from_search_id} = require("./utils");

const black_stone = new Image(); black_stone.src = "./gfx/black_stone.png";
const black_stone_url = `url("${black_stone.src}")`;

const white_stone = new Image(); white_stone.src = "./gfx/white_stone.png";
const white_stone_url = `url("${white_stone.src}")`;

const ko_marker = new Image(); ko_marker.src = "./gfx/ko.png";
const ko_marker_url = `url("${ko_marker.src}")`;

function new_board_drawer(backgrounddiv, htmltable, canvas, boardinfo) {

	let drawer = {};

	drawer.width = null;
	drawer.height = null;
	drawer.current = null;		// Becomes 2d array of... "b", "w", "ko"

	drawer.backgrounddiv = backgrounddiv;
	drawer.htmltable = htmltable;
	drawer.canvas = canvas;
	drawer.boardinfo = boardinfo;

	drawer.draw_board = function(node) {

		let board = node.get_board();

		if (this.width !== board.width || this.height !== board.height) {

			// Reset all the things.

			this.width = board.width;
			this.height = board.height;
			this.current = [];

			this.htmltable.innerHTML = "";
			this.htmltable.style["background-image"] = background(board.width, board.height, 32);

			for (let y = 0; y < board.height; y++) {
				let tr = document.createElement("tr");
				htmltable.appendChild(tr);
				for (let x = 0; x < board.width; x++) {
					let td = document.createElement("td");
					td.className = "td_" + xy_to_s(x, y);
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

			this.backgrounddiv.style.width = (board.width * 32).toString() + "px";
			this.backgrounddiv.style.height = (board.height * 32).toString() + "px";

			this.htmltable.style.width = (board.width * 32).toString() + "px";
			this.htmltable.style.height = (board.height * 32).toString() + "px";

			this.canvas.width = board.width * 32;
			this.canvas.height = board.height * 32;

			this.boardinfo.style.top = this.canvas.height + "px";
		}

		let board_ko_x = board.ko ? board.ko.charCodeAt(0) - 97 : -1;
		let board_ko_y = board.ko ? board.ko.charCodeAt(1) - 97 : -1;

		for (let x = 0; x < this.width; x++) {

			for (let y = 0; y < this.height; y++) {

				if (x === board_ko_x && y === board_ko_y) {

					if (this.current[x][y] !== "ko") {
						let td = this.htmltable.getElementsByClassName("td_" + xy_to_s(x, y))[0];
						td.style["background-image"] = ko_marker_url;
						this.current[x][y] = "ko";
					}

				} else {

					if (this.current[x][y] !== board.state[x][y]) {
						let td = this.htmltable.getElementsByClassName("td_" + xy_to_s(x, y))[0];
						if (board.state[x][y] === "b") {
							td.style["background-image"] = black_stone_url;
						} else if (board.state[x][y] === "w") {
							td.style["background-image"] = white_stone_url;
						} else {
							td.style["background-image"] = "";
						}
						this.current[x][y] = board.state[x][y];
					}
				}
			}
		}
	};

	drawer.draw_info = function(node, engine) {

		let board = node.get_board();

		let s = `komi: ${board.komi}, caps by B: ${board.caps_by_b}, by W: ${board.caps_by_w}`;

		if (engine && engine.running) {
			s += `, running...`;
		}

		this.boardinfo.innerHTML = s;
	};

	drawer.draw_canvas = function(node) {

		let ctx = this.canvas.getContext("2d");
		ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

		if (!node) {
			return;
		}

		let moves_played = node.all_values("B").concat(node.all_values("W"));

		for (let s of moves_played) {

			let x = s.charCodeAt(0) - 97;
			let y = s.charCodeAt(1) - 97;

			let gx = x * 32 + 16;
			let gy = y * 32 + 16;

			ctx.fillStyle = "#ff0000aa";
			ctx.beginPath();
			ctx.arc(gx, gy, 6, 0, 2 * Math.PI);
			ctx.fill();
		}

		if (!node.analysis) {
			return;
		}

		ctx.textAlign = "center";
		ctx.textBaseline = "middle";
		ctx.font = "14px Arial";

		if (Array.isArray(node.analysis.moveInfos) === false || node.analysis.moveInfos.length < 1) {
			return;
		}

		let move0_lcb = node.analysis.moveInfos[0].lcb;
		let root_visits = node.analysis.rootInfo.visits;

		ctx.strokeStyle = node.get_board().active === "b" ? "#00000080" : "#ffffff80";
		ctx.lineWidth = 3.5;

		for (let info of node.analysis.moveInfos) {

			if (info.order === 0 || (info.visits > root_visits * config.visits_threshold)) {

				if (info.order === 0) {
					ctx.fillStyle = "#68cebaff";
				} else if (info.lcb > move0_lcb * 0.975) {
					ctx.fillStyle = "#84ce4cff";
				} else {
					ctx.fillStyle = "#e4ce4cff";
				}

				let [x, y] = this.parse_gtp_move(info.move);

				if (x === -1 || y === -1) {
					break;
				}

				let gx = x * 32 + 16;
				let gy = y * 32 + 16;

				ctx.beginPath();
				ctx.arc(gx, gy, 16, 0, 2 * Math.PI);
				ctx.fill();

				ctx.beginPath();
				ctx.arc(gx, gy, 16 - 1, 0, 2 * Math.PI);		// Note the reduction of radius
				ctx.stroke();

				let s = "";

				if (config.numbers === "winrate") {
					s = Math.floor(info.winrate * 100).toString();
				}
				if (config.numbers === "visits_percent") {
					s = Math.floor(info.visits / root_visits * 100).toString();
				}
				if (config.numbers === "policy") {
					s = Math.floor(info.prior * 100).toString();
				}
				if (config.numbers === "score") {
					s = info.scoreLead.toFixed(1);
				}
				if (config.numbers === "visits") {
					s = info.visits.toString();
					if (info.visits > 9999) {
						s = (info.visits / 1000).toFixed(0) + "k";
					} else if (info.visits > 999) {
						s = (info.visits / 1000).toFixed(1) + "k";
					}
				}
				if (config.numbers === "order") {
					s = info.order.toString();
				}

				ctx.fillStyle = "#000000ff";
				ctx.fillText(s, gx, gy + 1);

			}
		}
	};

	drawer.clear_canvas = function() {
		let ctx = this.canvas.getContext("2d");
		ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
	};

	drawer.parse_gtp_move = function(s) {

		if (!this.width || !this.height || typeof s !== "string" || s.length < 2) {
			return [-1, -1];
		}

		let x = s.charCodeAt(0) - 65;
		if (x >= 8) {					// Adjust for missing "I"
			x--;
		}

		let y = this.height - parseInt(s.slice(1), 10);

		if (Number.isNaN(x) || Number.isNaN(y) || x < 0 || y < 0 || x >= this.width || y >= this.height) {
			return [-1, -1];
		}

		return [x, y];
	};

	return drawer;

}



module.exports = new_board_drawer;
