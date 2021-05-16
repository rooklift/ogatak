"use strict";

const background = require("./background");
const {moveinfo_filter, node_id_from_search_id, pad, opposite_colour, new_2d_array, xy_to_s} = require("./utils");

const black_stone = new Image(); black_stone.src = "./gfx/black_stone.png";
const black_stone_url = `url("${black_stone.src}")`;

const white_stone = new Image(); white_stone.src = "./gfx/white_stone.png";
const white_stone_url = `url("${white_stone.src}")`;

const black_stone_marked = new Image(); black_stone_marked.src = "./gfx/black_stone_marked.png";
const black_stone_marked_url = `url("${black_stone_marked.src}")`;

const white_stone_marked = new Image(); white_stone_marked.src = "./gfx/white_stone_marked.png";
const white_stone_marked_url = `url("${white_stone_marked.src}")`;

const ko_marker = new Image(); ko_marker.src = "./gfx/ko.png";
const ko_marker_url = `url("${ko_marker.src}")`;

function new_board_drawer(backgrounddiv, htmltable, canvas, infodiv) {

	let drawer = Object.create(board_drawer_prototype);

	drawer.width = null;
	drawer.height = null;

	drawer.backgrounddiv = backgrounddiv;
	drawer.htmltable = htmltable;
	drawer.canvas = canvas;
	drawer.infodiv = infodiv;

	drawer.tablestate = new_2d_array(52, 52, null);				// 2d array of "", "b", "w", "ko", "bm", "wm" ... we only look at indices inside our size.
	drawer.exclusion_array = new_2d_array(52, 52, null);		// 2d array used by draw_board for exclusions sent by the PV drawer.

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
			for (let y = 0; y < this.height; y++) {
				this.tablestate[x][y] = "";
			}
		}

		this.backgrounddiv.style.width = (this.width * config.square_size).toString() + "px";
		this.backgrounddiv.style.height = (this.height * config.square_size).toString() + "px";

		this.htmltable.style.width = (this.width * config.square_size).toString() + "px";
		this.htmltable.style.height = (this.height * config.square_size).toString() + "px";

		// We force the canvas to be at least big enough for a 19x19 board,
		// this makes other elements like the graph stay put when the board
		// size is actually smaller.

		this.canvas.width = Math.max(19, this.width) * config.square_size;
		this.canvas.height = Math.max(19, this.height) * config.square_size;

		this.infodiv.style["font-size"] = config.info_font_size.toString() + "px";
	},

	draw_standard: function(node) {
		this.clear_canvas();

		let board = node.get_board();
		let ownership = null;
		let ownership_perspective = null;

		if (config.dead_stone_prediction) {
			if (node.has_valid_analysis() && node.analysis.ownership) {
				ownership = node.analysis.ownership;
				ownership_perspective = board.active;
			}
		}

		this.draw_board(board, node, ownership, ownership_perspective, null);

		this.draw_previous_markers(node);
		this.draw_analysis(node);
		this.draw_next_markers(node);
		this.draw_node_info(node);
		this.last_draw_was_pv = false;
	},

	draw_pv: function(node, point) {			// Return true / false whether this happened.

		if (!config.candidate_moves || !config.mouseover_pv) {
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

		// We have a valid info, so the draw will proceed...

		this.clear_canvas();
		let ctx = this.canvas.getContext("2d");

		ctx.textAlign = "center";
		ctx.textBaseline = "middle";
		ctx.font = `${config.board_font_size}px Arial`;

		// Create our final board...

		let finalboard = startboard.copy();
		let points = [];

		for (let move of info.pv) {
			let s = finalboard.parse_gtp_move(move);
			finalboard.play(s);
			points.push(s);				// Note that passes are included as "", so our later colour alteration works correctly.
		}

		// We draw the final board now so that this.tablestate contains correct info about what is in the table, which we use in a bit...

		if (config.dead_stone_prediction && info.ownership) {
			this.draw_board(finalboard, node, info.ownership, startboard.active, points);
		} else {
			this.draw_board(finalboard, node, null, null, null);
		}

		// Create a map of sgf_points (s) --> {text, fill} objects...

		let colour = startboard.active;
		let n = 1;

		let numbers_to_draw = {};

		for (let s of points) {

			if (s.length === 2) {		// Otherwise, it's a pass and we don't draw it.

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

		// And draw...

		for (let [s, ntd] of Object.entries(numbers_to_draw)) {

			let x = s.charCodeAt(0) - 97;
			let y = s.charCodeAt(1) - 97;
			let gx = x * config.square_size + (config.square_size / 2);
			let gy = y * config.square_size + (config.square_size / 2);

			if (this.tablestate[x][y] === "bm" || this.tablestate[x][y] === "wm") {		// The stone has been marked as dead in our table, with a square.
				continue;
			}

			if (this.tablestate[x][y] === "" || this.tablestate[x][y] === "ko") {		// Stone captured; draw wood colour so grid doesn't clash with the text.
				ctx.fillStyle = config.wood_colour;
				ctx.beginPath();
				ctx.arc(gx, gy, config.square_size / 2, 0, 2 * Math.PI);
				ctx.fill();
			}

			ctx.fillStyle = ntd.fill;
			ctx.fillText(ntd.text, gx, gy + 1);

		}

		this.draw_node_info(node, info);

		this.last_draw_was_pv = true;
		return true;
	},

	clear_canvas: function() {
		let ctx = this.canvas.getContext("2d");
		ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
	},

	draw_board: function(board, responsible_node, ownership, ownership_perspective, markdead_exclusions) {

		this.draw_board.calls = (this.draw_board.calls || 0) + 1;

		// The ownership stuff should only be passed to this function if drawing it is desired.
		// We don't really check config.dead_stone_prediction, except for other reasons.

		// Note that the board one would get from responsible_node.get_board() is not necessarily
		// the same as the board passed to us, because this function is used to draw the final
		// board position after a PV.

		if (this.width !== board.width || this.height !== board.height) {
			this.rebuild(board.width, board.height);
		}

		if (markdead_exclusions) {
			for (let s of markdead_exclusions) {
				if (s.length === 2) {
					let x = s.charCodeAt(0) - 97;
					let y = s.charCodeAt(1) - 97;
					this.exclusion_array[x][y] = this.draw_board.calls;				// How we tell that it was set to excluded this call.
				}
			}
		}

		let board_ko_x = board.ko ? board.ko.charCodeAt(0) - 97 : -1;
		let board_ko_y = board.ko ? board.ko.charCodeAt(1) - 97 : -1;

		for (let x = 0; x < this.width; x++) {
			for (let y = 0; y < this.height; y++) {

				let state = board.state[x][y];
				let desired = state;

				if (x === board_ko_x && y === board_ko_y) {
					desired = "ko";
				} else if (state === "b" || state === "w") {						// Sometimes upgrade desired to "bm" or "wm".
					if (this.exclusion_array[x][y] === this.draw_board.calls) {
						// Nothing. Exclusions passed by draw_pv are not to be marked.
					} else if (ownership) {
						let own = ownership[x + (y * board.width)];
						if (ownership_perspective !== state) {
							own *= -1;
						}
						if (own < 0) {
							desired = state === "b" ? "bm" : "wm";
						}
					} else if (this.tablestate[x][y] === (state === "b" ? "bm" : "wm")) {
						// Might be acceptable to delay changing the element until we get an update from the engine...
						if (config.dead_stone_prediction && hub.engine.desired && node_id_from_search_id(hub.engine.desired.id) === responsible_node.id) {
							desired = state === "b" ? "bm" : "wm";
						}
					}
				}

				if (this.tablestate[x][y] !== desired) {

					let td = this.htmltable.getElementsByClassName("td_" + xy_to_s(x, y))[0];

					switch (desired) {
						case   "": td.style["background-image"] =                     ""; break;
						case  "b": td.style["background-image"] =        black_stone_url; break;
						case  "w": td.style["background-image"] =        white_stone_url; break;
						case "ko": td.style["background-image"] =          ko_marker_url; break;
						case "bm": td.style["background-image"] = black_stone_marked_url; break;
						case "wm": td.style["background-image"] = white_stone_marked_url; break;
					}

					this.tablestate[x][y] = desired;
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

		s += `<span class="boardinfo_rules">Rules: <span class="white">${pad(board.rules, 16)}</span></span>`;
		s += `<span class="boardinfo_komi">Komi: <span class="white">${pad(board.komi, 8)}</span></span>`;
		s += `Prev: <span class="white">${pad(last_move, 6)}</span>`;
		s += `<span class="boardinfo_numbers">Showing: <span class="white">${pad(config.candidate_moves ? config.numbers : "(hidden)", 11)}</span></span>`;

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

		let capstring = `${board.caps_by_b} | ${board.caps_by_w}`;

		s += `Caps by B|W: <span class="white">${pad(capstring, 9)}</span>`;
		s += `Score: <span class="white">${pad(score, 8)}</span>`;
		s += `${override_moveinfo ? "This" : "Best"}: <span class="white">${pad(move, 7)}</span>`;
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

			if (info.order === 0 && config.circle_best) {
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
				text = info.scoreLead < 0 ? "-" : "+";
				let absl = Math.abs(info.scoreLead);
				if (absl < 10) {
					text += absl.toFixed(1);
					if (text === "-10.0") text = "-10";
					if (text === "+10.0") text = "+10";
				} else {
					text += Math.floor(absl);
				}
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
				text = (info.order + 1).toString();
			}

			ctx.fillStyle = "#000000ff";
			ctx.fillText(text, gx, gy + 1);
		}
	},
};



module.exports = new_board_drawer;
