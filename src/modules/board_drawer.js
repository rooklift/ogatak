"use strict";

const background = require("./background");
const {xy_to_s} = require("./utils");
const {moveinfo_filter, node_id_from_search_id, pad, opposite_colour} = require("./utils");

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

	drawer.last_draw_was_pv = false;

	return drawer;
}

let board_drawer_prototype = {

	rebuild: function(width, height) {

		// Reset all the things.

		if (!width || !height) {
			throw "rebuild() needs board sizes";
		}

		this.width = width;
		this.height = height;
		this.current = [];

		this.htmltable.innerHTML = "";
		this.htmltable.style["background-image"] = background(this.width, this.height, config.square_size);

		for (let y = 0; y < this.height; y++) {
			let tr = document.createElement("tr");
			this.htmltable.appendChild(tr);
			for (let x = 0; x < this.width; x++) {
				let td = document.createElement("td");
				td.className = "td_" + xy_to_s(x, y);
				td.width = config.square_size;
				td.height = config.square_size;
				td.addEventListener("mouseenter", (event) => {
					hub.mouseenter(xy_to_s(x, y));
				});
				tr.appendChild(td);
			}
		}

		for (let x = 0; x < this.width; x++) {
			this.current.push([]);
			for (let y = 0; y < this.height; y++) {
				this.current[x].push("");
			}
		}

		this.backgrounddiv.style.width = (this.width * config.square_size).toString() + "px";
		this.backgrounddiv.style.height = (this.height * config.square_size).toString() + "px";

		this.htmltable.style.width = (this.width * config.square_size).toString() + "px";
		this.htmltable.style.height = (this.height * config.square_size).toString() + "px";

		this.canvas.width = this.width * config.square_size;
		this.canvas.height = this.height * config.square_size;

	},

	draw_standard: function(node) {
		this.clear_canvas();
		this.draw_board(node.get_board());
		this.draw_previous_markers(node);
		this.draw_analysis(node);
		this.draw_next_markers(node);
		this.draw_node_info(node);
		this.last_draw_was_pv = false;
	},

	draw_pv: function(node, point) {			// Return true / false whether this happened.

		let filtered_infos = moveinfo_filter(node);

		if (filtered_infos.length < 1) {
			return false;
		}

		let startboard = node.get_board();
		let gtp = startboard.gtp(point);

		let pv;

		for (let info of filtered_infos) {
			if (info.move === gtp) {
				if (Array.isArray(info.pv) && info.pv.length > 0) {
					pv = info.pv;
				}
				break;
			}
		}

		if (!pv) {
			return false;
		}

		this.clear_canvas();
		let ctx = this.canvas.getContext("2d");

		let finalboard = startboard.copy();
		let points = [];

		for (let move of pv) {
			let s = finalboard.parse_gtp_move(move);
			finalboard.play(s);
			points.push(s);
		}

		let colour = startboard.active;
		let n = 1;

		for (let s of points) {

			let x = s.charCodeAt(0) - 97;
			let y = s.charCodeAt(1) - 97;

			let gx = x * config.square_size + (config.square_size / 2);
			let gy = y * config.square_size + (config.square_size / 2);

			if (finalboard.state[x][y] === "") {		// The stone got captured, we draw some wood colour so the grid doesn't clash with the text.
				ctx.fillStyle = config.empty_colour;
				ctx.beginPath();
				ctx.arc(gx, gy, config.square_size / 2, 0, 2 * Math.PI);
				ctx.fill();
			}

			ctx.fillStyle = colour === "b" ? "#ffffffff" : "#000000ff";
			ctx.fillText(n.toString(), gx, gy + 1);

			colour = opposite_colour(colour);
			n++;
		}

		this.draw_board(finalboard);
		this.draw_node_info(node);

		this.last_draw_was_pv = true;
		return true;
	},

	clear_canvas: function() {
		let ctx = this.canvas.getContext("2d");
		ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
	},

	draw_board: function(board) {

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

	draw_node_info: function(node) {

		let board = node.get_board();

		let s = "";

		s += `komi: <span class="white">${pad(board.komi, 6)}</span>`;
		s += `caps by B: <span class="white">${pad(board.caps_by_b, 4)}</span>`;
		s += `by W: <span class="white">${pad(board.caps_by_w, 4)}</span>`;
		s += `showing: <span class="white">${pad(config.numbers, 11)}</span>`;

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

	draw_previous_markers: function(node) {

		let ctx = this.canvas.getContext("2d");
		let board = node.get_board();

		ctx.fillStyle = config.previous_marker;

		let moves_played = node.all_values("B").concat(node.all_values("W"));

		for (let s of moves_played) {		// Probably just one.

			let x = s.charCodeAt(0) - 97;
			let y = s.charCodeAt(1) - 97;

			let gx = x * config.square_size + (config.square_size / 2);
			let gy = y * config.square_size + (config.square_size / 2);

			ctx.beginPath();
			ctx.arc(gx, gy, Math.ceil(config.square_size / 5), 0, 2 * Math.PI);
			ctx.fill();
		}
	},

	draw_next_markers: function(node) {

		if (!config.next_move_markers) {
			return;
		}

		let board = node.get_board();
		let ctx = this.canvas.getContext("2d");

		ctx.strokeStyle = board.active === "b" ? "#00000080" : "#ffffffa0";
		ctx.lineWidth = 3.5;

		for (let n = 0; n < node.children.length; n++) {

			let moves_played = node.children[n].all_values("B").concat(node.children[n].all_values("W"));

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
	},

	draw_analysis: function(node) {

		if (!node.has_valid_analysis()) {
			return;
		}

		let board = node.get_board();

		let ctx = this.canvas.getContext("2d");

		ctx.textAlign = "center";
		ctx.textBaseline = "middle";
		ctx.font = "14px Arial";

		ctx.strokeStyle = board.active === "b" ? "#00000080" : "#ffffffa0";
		ctx.lineWidth = 3.5;

		let move0_lcb = node.analysis.moveInfos[0].lcb;
		let root_visits = node.analysis.rootInfo.visits;

		let filtered_infos = moveinfo_filter(node);

		for (let n = filtered_infos.length - 1; n >= 0; n--) {

			// We look at these in reverse order so the best move can have its circle drawn at the top layer.

			let info = filtered_infos[n];

			let s = board.parse_gtp_move(info.move);

			if (!s) {			// This is a pass.
				continue;
			}

			let x = s.charCodeAt(0) - 97;
			let y = s.charCodeAt(1) - 97;

			let gx = x * config.square_size + (config.square_size / 2);
			let gy = y * config.square_size + (config.square_size / 2);

			if (info.order === 0) {
				ctx.fillStyle = config.best_colour;
			} else if (info.lcb > move0_lcb * 0.975) {
				ctx.fillStyle = config.good_colour;
			} else {
				ctx.fillStyle = config.poor_colour;
			}

			ctx.beginPath();
			ctx.arc(gx, gy, config.square_size / 2, 0, 2 * Math.PI);
			ctx.fill();

			if (info.order === 0) {
				ctx.beginPath();
				ctx.arc(gx, gy, (config.square_size / 2) - 1, 0, 2 * Math.PI);		// Note the reduction of radius
				ctx.stroke();
			}

			let text = "?";

			if (config.numbers === "winrate") {
				text = Math.floor(Math.max(0, info.winrate * 100)).toString();
			}
			if (config.numbers === "lcb") {
				text = Math.floor(Math.max(0, info.lcb * 100)).toString();
			}
			if (config.numbers === "visits (%)") {
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
	},
};



module.exports = new_board_drawer;
