"use strict";

const background = require("./background");
const {xy_to_s} = require("./utils");
const {node_id_from_search_id, pad} = require("./utils");

const black_stone = new Image(); black_stone.src = "./gfx/black_stone.png";
const black_stone_url = `url("${black_stone.src}")`;

const white_stone = new Image(); white_stone.src = "./gfx/white_stone.png";
const white_stone_url = `url("${white_stone.src}")`;

const ko_marker = new Image(); ko_marker.src = "./gfx/ko.png";
const ko_marker_url = `url("${ko_marker.src}")`;

function new_board_drawer(backgrounddiv, htmltable, canvas, infodiv) {

	let drawer = Object.create(board_drawer_prototype);

	drawer.width = null;
	drawer.height = null;
	drawer.current = null;		// Becomes 2d array of... "b", "w", "ko"

	drawer.backgrounddiv = backgrounddiv;
	drawer.htmltable = htmltable;
	drawer.canvas = canvas;
	drawer.infodiv = infodiv;

	return drawer;
}

let board_drawer_prototype = {

	rebuild: function(width, height) {

		if (!width || !height) {
			throw "rebuild() needs board sizes";
		}

		// Reset all the things.

		this.width = width;
		this.height = height;
		this.current = [];

		this.htmltable.innerHTML = "";
		this.htmltable.style["background-image"] = background(width, height, config.square_size);

		for (let y = 0; y < height; y++) {
			let tr = document.createElement("tr");
			this.htmltable.appendChild(tr);
			for (let x = 0; x < width; x++) {
				let td = document.createElement("td");
				td.className = "td_" + xy_to_s(x, y);
				td.width = config.square_size;
				td.height = config.square_size;
				tr.appendChild(td);
			}
		}

		for (let x = 0; x < width; x++) {
			this.current.push([]);
			for (let y = 0; y < height; y++) {
				this.current[x].push("");
			}
		}

		this.backgrounddiv.style.width = (width * config.square_size).toString() + "px";
		this.backgrounddiv.style.height = (height * config.square_size).toString() + "px";

		this.htmltable.style.width = (width * config.square_size).toString() + "px";
		this.htmltable.style.height = (height * config.square_size).toString() + "px";

		this.canvas.width = width * config.square_size;
		this.canvas.height = height * config.square_size;

	},

	draw_board: function(node) {

		let board = node.get_board();

		if (this.width !== board.width || this.height !== board.height) {
			this.rebuild(board.width, board.height);
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
	},

	draw_info: function(node, engine) {

		let board = node.get_board();

		let s = "";

		s += `komi: <span class="white">${pad(board.komi, 6)}</span>`;
		s += `caps by B: <span class="white">${pad(board.caps_by_b, 4)}</span>`;
		s += `by W: <span class="white">${pad(board.caps_by_w, 4)}</span>`;

		s += "<br>";

		let best = "";
		let score = "";
		let visits = "";

		if (node.has_valid_analysis()) {
			best = node.analysis.moveInfos[0].move;
			visits = `${node.analysis.moveInfos[0].visits} / ${node.analysis.rootInfo.visits}`;

			let lead = node.analysis.moveInfos[0].scoreLead;
			let leader = ((lead >= 0 && board.active === "b") || (lead < 0 && board.active === "w")) ? "B" : "W";
			if (lead < 0) lead *= -1;
			score = `${leader}+${lead.toFixed(1)}`;
		}

		s += `best: <span class="white">${pad(best, 6)}</span>`;
		s += `score: <span class="white">${pad(score, 8)}</span>`;
		s += `visits: <span class="white">${pad(visits, 15)}</span>`;

		this.infodiv.innerHTML = `<span class="rust">${s}</span>`;
	},

	draw_canvas: function(node) {

		let ctx = this.canvas.getContext("2d");
		ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

		if (!node) {
			return;
		}

		let board = node.get_board();

		let moves_played = node.all_values("B").concat(node.all_values("W"));

		for (let s of moves_played) {		// Probably just one.

			let x = s.charCodeAt(0) - 97;
			let y = s.charCodeAt(1) - 97;

			let gx = x * config.square_size + (config.square_size / 2);
			let gy = y * config.square_size + (config.square_size / 2);

			ctx.fillStyle = "#ff0000aa";
			ctx.beginPath();
			ctx.arc(gx, gy, Math.ceil(config.square_size / 5), 0, 2 * Math.PI);
			ctx.fill();
		}

		ctx.strokeStyle = board.active === "b" ? "#00000080" : "#ffffffa0";
		ctx.lineWidth = 3.5;

		if (node.has_valid_analysis()) {

			ctx.textAlign = "center";
			ctx.textBaseline = "middle";
			ctx.font = "14px Arial";

			let move0_lcb = node.analysis.moveInfos[0].lcb;
			let root_visits = node.analysis.rootInfo.visits;

			for (let info of node.analysis.moveInfos) {

				if (info.order === 0 || (info.visits > root_visits * config.visits_threshold && info.lcb >= 0)) {

					let s = board.parse_gtp_move(info.move);

					if (!s) {			// This is a pass.
						continue;
					}

					let x = s.charCodeAt(0) - 97;
					let y = s.charCodeAt(1) - 97;

					let gx = x * config.square_size + (config.square_size / 2);
					let gy = y * config.square_size + (config.square_size / 2);

					if (info.order === 0) {
						ctx.fillStyle = "#99dd55ff";				// "#68cebaff";
					} else if (info.lcb > move0_lcb * 0.975) {
						ctx.fillStyle = "#d2b074ff";				// "#84ce4cff";
					} else {
						ctx.fillStyle = "#d2b074ff";				// "#e4ce4cff";
					}

					ctx.beginPath();
					ctx.arc(gx, gy, config.square_size / 2, 0, 2 * Math.PI);
					ctx.fill();

					// ctx.beginPath();
					// ctx.arc(gx, gy, (config.square_size / 2) - 1, 0, 2 * Math.PI);		// Note the reduction of radius
					// ctx.stroke();

					let text = "";

					if (config.numbers === "winrate") {
						text = Math.floor(Math.max(0, info.winrate * 100)).toString();
					}
					if (config.numbers === "lcb") {
						text = Math.floor(Math.max(0, info.lcb * 100)).toString();
					}
					if (config.numbers === "visits_percent") {
						text = Math.floor(info.visits / root_visits * 100).toString();
					}
					if (config.numbers === "policy") {
						text = Math.floor(info.prior * 100).toString();
					}
					if (config.numbers === "score") {
						text = info.scoreLead.toFixed(1);
					}
					if (config.numbers === "visits") {
						text = info.visits.toString();
						if (info.visits > 9999) {
							text = (info.visits / 1000).toFixed(0) + "k";
						} else if (info.visits > 999) {
							text = (info.visits / 1000).toFixed(1) + "k";
						}
					}
					if (config.numbers === "order") {
						text = info.order.toString();
					}

					ctx.fillStyle = "#000000ff";
					ctx.fillText(text, gx, gy + 1);

				}
			}
		}

		if (config.next_move_markers) {

			for (let n = 0; n < node.children.length; n++) {

				moves_played = node.children[n].all_values("B").concat(node.children[n].all_values("W"));

				for (let s of moves_played) {		// Probably just one per child.

					let x = s.charCodeAt(0) - 97;
					let y = s.charCodeAt(1) - 97;

					let gx = x * config.square_size + (config.square_size / 2);
					let gy = y * config.square_size + (config.square_size / 2);

					ctx.beginPath();
					ctx.arc(gx, gy, (config.square_size / 2) - 1, 0, 2 * Math.PI);
					ctx.stroke();
				}
			}
		}
	},

};



module.exports = new_board_drawer;
