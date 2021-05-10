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

		let png = background(this.width, this.height, config.square_size);
		this.htmltable.style["background-image"] = `url("${png}")`;
		this.htmltable.innerHTML = "";

		for (let y = 0; y < this.height; y++) {
			let tr = document.createElement("tr");
			this.htmltable.appendChild(tr);
			for (let x = 0; x < this.width; x++) {
				let td = document.createElement("td");
				let s = xy_to_s(x, y);
				td.className = "td_" + s;
				td.width = config.square_size;
				td.height = config.square_size;
				td.addEventListener("mouseenter", (event) => {
					hub.mouse_entering_point(s);
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

		if (!config.candidate_moves) {
			return false;
		}

		let filtered_infos = moveinfo_filter(node);

		if (filtered_infos.length < 1) {
			return false;
		}

		let startboard = node.get_board();
		let gtp = startboard.gtp(point);

		let info;

		for (let foo of filtered_infos) {
			if (foo.move === gtp) {
				if (Array.isArray(foo.pv) && foo.pv.length > 0) {
					info = foo;
				}
				break;
			}
		}

		if (!info) {
			return false;
		}

		this.clear_canvas();
		let ctx = this.canvas.getContext("2d");

		ctx.textAlign = "center";
		ctx.textBaseline = "middle";
		ctx.font = `${config.board_font_size}px Arial`;

		let finalboard = startboard.copy();
		let points = [];

		for (let move of info.pv) {
			let s = finalboard.parse_gtp_move(move);
			finalboard.play(s);
			points.push(s);				// Note that passes are included, so our later colour alteration works correctly.
		}

		let colour = startboard.active;
		let n = 1;

		let numbers_to_draw = {};

		for (let s of points) {

			if (s.length == 2) {		// Otherwise, it's a pass and we don't draw it.

				// We use the last colour played on a point, but if 2 or more stones were played, text becomes "+"

				let text = numbers_to_draw[s] ? "+" : n.toString();

				numbers_to_draw[s] = {
					text: text,
					fill: colour === "b" ? "#ffffffff" : "#000000ff",
				};
			}

			colour = opposite_colour(colour);
			n++;
		}

		for (let [s, ntd] of Object.entries(numbers_to_draw)) {

			let x = s.charCodeAt(0) - 97;
			let y = s.charCodeAt(1) - 97;
			let gx = x * config.square_size + (config.square_size / 2);
			let gy = y * config.square_size + (config.square_size / 2);

			if (finalboard.state_at(s) === "") {		// The stone got captured, we draw some wood colour so the grid doesn't clash with the text.
				ctx.fillStyle = config.wood_colour;
				ctx.beginPath();
				ctx.arc(gx, gy, config.square_size / 2, 0, 2 * Math.PI);
				ctx.fill();
			}

			ctx.fillStyle = ntd.fill;
			ctx.fillText(ntd.text, gx, gy + 1);

		}

		this.draw_board(finalboard);
		this.draw_node_info(node, info);

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

	draw_node_info: function(node, override_moveinfo) {

		let board = node.get_board();

		let last_move = "";
		let last_move_props = node.all_values("B").concat(node.all_values("W"));
		if (last_move_props.length === 1) {
			last_move = board.gtp(last_move_props[0]);
		}

		let s = "";

		s += `Caps by B: <span class="white">${pad(board.caps_by_b, 5)}</span>`;
		s += `Komi: <span class="white">${pad(board.komi, 8)}</span>`;
		s += `Prev: <span class="white">${pad(last_move, 5)}</span>`;

		if (config.candidate_moves) {
			s += `Showing: <span class="white">${pad(config.numbers, 1)}</span>`;
		} else {
			s += `Showing: <span class="white">${pad("(hidden)", 11)}</span>`;
		}

		s += "<br>";

		let move = "";
		let score = "";
		let visits = "";

		if (node.has_valid_analysis()) {

			let moveinfo = override_moveinfo || node.analysis.moveInfos[0];

			move = moveinfo.move;

			visits = `${moveinfo.visits} / ${node.analysis.rootInfo.visits}`;

			let lead = moveinfo.scoreLead;
			let leader = ((lead >= 0 && board.active === "b") || (lead < 0 && board.active === "w")) ? "B" : "W";
			if (lead < 0) lead *= -1;
			score = `${leader}+${lead.toFixed(1)}`;
		}

		s += `     by W: <span class="white">${pad(board.caps_by_w, 4)}</span>`;
		s += `Score: <span class="white">${pad(score, 8)}</span>`;
		if (override_moveinfo) {
			s += `This: <span class="white">${pad(move, 6)}</span>`;
		} else {
			s += `Best: <span class="white">${pad(move, 6)}</span>`;
		}
		s += `Visits: <span class="white">${pad(visits, 15)}</span>`;

		this.infodiv.innerHTML = s;
	},

	draw_previous_markers: function(node) {

		let ctx = this.canvas.getContext("2d");
		let board = node.get_board();

		ctx.fillStyle = config.previous_marker;

		let moves_played = node.all_values("B").concat(node.all_values("W"));

		for (let s of moves_played) {		// Probably just one.

			if (s.length !== 2) {
				continue;
			}

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

		ctx.lineWidth = 3.5;

		for (let key of ["B", "W"]) {

			ctx.strokeStyle = key === "B" ? "#00000080" : "#ffffffa0";

			for (let n = 0; n < node.children.length; n++) {

				let moves_played = node.children[n].all_values(key);

				for (let s of moves_played) {		// Probably just one per child.

					if (s.length !== 2) {
						continue;
					}

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

	draw_analysis: function(node) {

		if (!node.has_valid_analysis() || !config.candidate_moves) {
			return;
		}

		let board = node.get_board();

		let ctx = this.canvas.getContext("2d");

		ctx.textAlign = "center";
		ctx.textBaseline = "middle";
		ctx.font = `${config.board_font_size}px Arial`;

		ctx.strokeStyle = board.active === "b" ? "#00000080" : "#ffffffa0";
		ctx.lineWidth = 3.5;

		let move0_lcb = node.analysis.moveInfos[0].lcb;
		let root_visits = node.analysis.rootInfo.visits;

		let filtered_infos = moveinfo_filter(node);

		for (let n = filtered_infos.length - 1; n >= 0; n--) {

			// We look at these in reverse order so the best move can have its circle drawn at the top layer.

			let info = filtered_infos[n];

			let s = board.parse_gtp_move(info.move);

			if (s.length !== 2) {	// This is a pass.
				continue;
			}

			let x = s.charCodeAt(0) - 97;
			let y = s.charCodeAt(1) - 97;

			let gx = x * config.square_size + (config.square_size / 2);
			let gy = y * config.square_size + (config.square_size / 2);

			if (info.order === 0) {
				ctx.fillStyle = board.active === "b" ? config.best_colour_black : config.best_colour_white;
			} else {
				ctx.fillStyle = config.wood_colour;
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
