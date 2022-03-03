"use strict";

// Overview:
//  - Single-purpose div:   wood texture
//  - Table background:     grid lines
//  - Table TD elements:    nothing / black stone / white stone
//  - Canvas:               everything else
//
// To avoid conflicts when using the canvas:
//  - We plan everything to be drawn, placing objects in the .needed_marks array.
//  - Since only 1 object can be at each spot, conflicts are avoided.
//
// Complications:
//  - Next-move-markers can coincide with various stuff.
//  - Flicker introduced by death marks when stepping forward.

const background = require("./background");
const {moveinfo_filter, node_id_from_search_id, pad, new_2d_array, xy_to_s, float_to_hex_ff, points_list} = require("./utils");
const {get_ownership_colours} = require("./ownership_colours");

// ------------------------------------------------------------------------------------------------

let mouseenter_handlers = new_2d_array(25, 25, null);

for (let x = 0; x < 25; x++) {				// Create the event handlers for all usable values of x,y...
	for (let y = 0; y < 25; y++) {			// These will be attached to TD elements, firing on "mouseenter" events.
		let s = xy_to_s(x, y);
		mouseenter_handlers[x][y] = () => {
			hub.mouse_entering_point(s);
		};
	}
}

// ------------------------------------------------------------------------------------------------

const black_stone = new Image();	black_stone.src = "./gfx/black_stone.png";		const black_stone_url = `url("${black_stone.src}")`;
const white_stone = new Image();	white_stone.src = "./gfx/white_stone.png";		const white_stone_url = `url("${white_stone.src}")`;

// ------------------------------------------------------------------------------------------------

function init() {

	let ret = Object.assign(Object.create(board_drawer_prototype), {

		backgrounddiv: document.getElementById("boardbg"),
		ownercanvas:   document.getElementById("ownershipcanvas"),
		htmltable:     document.getElementById("boardtable"),
		canvas:        document.getElementById("boardcanvas"),
		infodiv:       document.getElementById("boardinfo"),

		ctx: document.getElementById("boardcanvas").getContext("2d"),
		ownerctx: document.getElementById("ownershipcanvas").getContext("2d"),

		pv: null,									// The PV drawn, or null if there isn't one.
		has_ownership_marks: false,					// Whether any ownership marks are being shown.
		table_state: new_2d_array(25, 25, ""),		// "", "b", "w" ... what the TD is displaying.
		needed_marks: new_2d_array(25, 25, null),	// Objects representing stuff waiting to be drawn to the canvas.

		wood_helps: new_2d_array(25, 25, null),		// What colour wood() draws. Not updated if the ownership map isn't drawn.
		wood_helps_are_valid: false,				// Thus, false if the above array wasn't updated.

		width: null,
		height: null,								
		square_size: null,							// We need to store width and height... the other things are mostly stored so
		board_line_width: null,						// we can detect when they don't match config and a rebuild() call is needed.
		grid_colour: null,

	});

	ret.set_infodiv_font_size(config.info_font_size);
	return ret;
}

let board_drawer_prototype = {

	rebuild: function(width, height) {				// Reset all the things...

		if (!width || !height) {
			throw "rebuild() needs board sizes";
		}

		// Remove all registered "mouseenter" handlers on the old TD elements...
		// This might be rather unnecessary, they should get GC'd anyway.

		if (this.width && this.height) {
			for (let x = 0; x < this.width; x++) {
				for (let y = 0; y < this.height; y++) {
					let td = this.htmltable.getElementsByClassName("td_" + xy_to_s(x, y))[0];
					td.removeEventListener("mouseenter", mouseenter_handlers[x][y]);
				}
			}
		}

		if (this.width > 19 || width > 19) {
			tree_drawer.canvas.width = tree_drawer.canvas.width;		// Lame anti-flicker hack for transitioning to oversized boards. Not important.
		}

		// Obviously we want to save the width and height, but we also save the state of relevant config
		// vars at the time of the rebuild, so we can detect if a new rebuild is needed later...

		this.width = width;
		this.height = height;
		this.square_size = config.square_size;
		this.board_line_width = config.board_line_width;
		this.grid_colour = config.grid_colour;

		let png = background(this.width, this.height, config.square_size, config.board_line_width, config.grid_colour);
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
				td.addEventListener("mouseenter", mouseenter_handlers[x][y]);	// Add "mouseenter" handler to the TD element.
				tr.appendChild(td);
			}
		}

		for (let x = 0; x < 25; x++) {
			for (let y = 0; y < 25; y++) {
				this.table_state[x][y] = "";
			}
		}

		this.has_ownership_marks = false;
		this.wood_helps_are_valid = false;
		this.pv = null;

		this.backgrounddiv.style.width = (this.width * config.square_size).toString() + "px";
		this.backgrounddiv.style.height = (this.height * config.square_size).toString() + "px";

		this.htmltable.style.width = (this.width * config.square_size).toString() + "px";
		this.htmltable.style.height = (this.height * config.square_size).toString() + "px";

		this.canvas.width = Math.max(19, this.width) * config.square_size;		// We force the canvas to be at least big enough for a 19x19 board, this
		this.canvas.height = Math.max(19, this.height) * config.square_size;	// makes other elements like the graph stay put when the board is smaller.

		this.ownercanvas.width = this.canvas.width;
		this.ownercanvas.height = this.canvas.height;
	},

	rebuild_if_needed(board) {
		if (this.width !== board.width ||
			this.height !== board.height ||
			this.square_size !== config.square_size ||
			this.board_line_width !== config.board_line_width ||
			this.grid_colour !== config.grid_colour
		) {
			this.rebuild(board.width, board.height);
		}
	},

	set_infodiv_font_size: function(value) {
		this.infodiv.style["font-size"] = value.toString() + "px";
	},

	// --------------------------------------------------------------------------------------------
	// Low-level canvas methods. Methods that call for "fractions" want a number between 0 and 1 to
	// set the size of something, relative to the square size...

	fcircle: function(x, y, fraction, colour) {
		let ctx = this.ctx;
		ctx.fillStyle = colour;
		let gx = x * config.square_size + (config.square_size / 2);
		let gy = y * config.square_size + (config.square_size / 2);
		ctx.beginPath();
		ctx.arc(gx, gy, fraction * config.square_size / 2, 0, 2 * Math.PI);
		ctx.fill();
	},

	circle: function(x, y, line_fraction, fraction, colour) {
		let ctx = this.ctx;
		ctx.lineWidth = line_fraction * config.square_size;
		ctx.strokeStyle = colour;
		let gx = x * config.square_size + (config.square_size / 2);
		let gy = y * config.square_size + (config.square_size / 2);
		ctx.beginPath();
		ctx.arc(gx, gy, (fraction * config.square_size / 2) - (line_fraction * config.square_size / 2), 0, 2 * Math.PI);
		ctx.stroke();
	},

	fsquare: function(x, y, fraction, colour, ownership_canvas_flag) {
		let ctx = !ownership_canvas_flag ? this.ctx : this.ownerctx;
		ctx.fillStyle = colour;
		let gx = x * config.square_size + (config.square_size / 2) - (config.square_size * fraction / 2);
		let gy = y * config.square_size + (config.square_size / 2) - (config.square_size * fraction / 2);
		ctx.fillRect(gx, gy, config.square_size * fraction, config.square_size * fraction);
	},

	square: function(x, y, line_fraction, fraction, colour) {
		let ctx = this.ctx;
		ctx.lineWidth = line_fraction * config.square_size;
		ctx.strokeStyle = colour;
		let gx = x * config.square_size + (config.square_size / 2);
		let gy = y * config.square_size + (config.square_size / 2);
		ctx.beginPath();
		ctx.moveTo(gx - (fraction * config.square_size / 2), gy - (fraction * config.square_size / 2));
		ctx.lineTo(gx + (fraction * config.square_size / 2), gy - (fraction * config.square_size / 2));
		ctx.lineTo(gx + (fraction * config.square_size / 2), gy + (fraction * config.square_size / 2));
		ctx.lineTo(gx - (fraction * config.square_size / 2), gy + (fraction * config.square_size / 2));
		ctx.closePath();
		ctx.stroke();
	},

	cross: function(x, y, line_fraction, fraction, colour) {
		let ctx = this.ctx;
		ctx.lineWidth = line_fraction * config.square_size;
		ctx.strokeStyle = colour;
		let gx = x * config.square_size + (config.square_size / 2);
		let gy = y * config.square_size + (config.square_size / 2);
		ctx.beginPath();
		ctx.moveTo(gx - (config.square_size * fraction / 2), gy - (config.square_size * fraction / 2));
		ctx.lineTo(gx + (config.square_size * fraction / 2), gy + (config.square_size * fraction / 2));
		ctx.stroke();
		ctx.beginPath();
		ctx.moveTo(gx - (config.square_size * fraction / 2), gy + (config.square_size * fraction / 2));
		ctx.lineTo(gx + (config.square_size * fraction / 2), gy - (config.square_size * fraction / 2));
		ctx.stroke();
	},

	triangle: function(x, y, line_fraction, fraction, colour) {
		let ctx = this.ctx;
		ctx.lineWidth = line_fraction * config.square_size;
		ctx.strokeStyle = colour;
		let gx = x * config.square_size + (config.square_size / 2);
		let gy = y * config.square_size + (config.square_size / 2);
		let unit = config.square_size * fraction / 2;
		ctx.beginPath();
		ctx.moveTo(gx, 1 + gy - unit);
		ctx.lineTo(gx + unit * 0.866, 1 + gy + unit / 2);
		ctx.lineTo(gx - unit * 0.866, 1 + gy + unit / 2);
		ctx.closePath();
		ctx.stroke();
	},

	text: function(x, y, msg, colour) {
		let ctx = this.ctx;
		ctx.textAlign = "center";
		ctx.textBaseline = "middle";
		ctx.font = `${config.board_font_size}px Arial`;
		ctx.fillStyle = colour;
		let gx = x * config.square_size + (config.square_size / 2);
		let gy = y * config.square_size + (config.square_size / 2);
		ctx.fillText(msg, gx, gy + 1);
	},

	text_two: function(x, y, msg, msg2, colour) {
		let ctx = this.ctx;
		ctx.textAlign = "center";
		ctx.textBaseline = "middle";
		ctx.font = `${config.board_font_size}px Arial`;
		ctx.fillStyle = colour;
		let gx = x * config.square_size + (config.square_size / 2);
		let gy = y * config.square_size + (config.square_size / 3) - 0.5;
		ctx.fillText(msg, gx, gy + 1);
		gy = y * config.square_size + (config.square_size * 2 / 3) + 0.5;
		ctx.fillText(msg2, gx, gy + 1);
	},

	text_three: function(x, y, msg, msg2, msg3, colour) {
		let ctx = this.ctx;
		ctx.textAlign = "center";
		ctx.textBaseline = "middle";
		ctx.font = `${config.board_font_size}px Arial`;
		ctx.fillStyle = colour;
		let gx = x * config.square_size + (config.square_size / 2);
		let gy;
		
		gy = y * config.square_size + (config.square_size * 0.22);
		ctx.fillText(msg, gx, gy + 1);
		gy = y * config.square_size + (config.square_size * 0.5);
		ctx.fillText(msg2, gx, gy + 1);
		gy = y * config.square_size + (config.square_size * 0.78);
		ctx.fillText(msg3, gx, gy + 1);
	},

	wood: function(x, y) {
		if (this.wood_helps_are_valid) {
			this.fcircle(x, y, 1, this.wood_helps[x][y]);
		} else {
			this.fcircle(x, y, 1, config.wood_colour);
		}
	},

	// --------------------------------------------------------------------------------------------
	// Low-level table TD method...

	set_td: function(x, y, foo) {

		let td = this.htmltable.getElementsByClassName("td_" + xy_to_s(x, y))[0];
		if (!td) throw "set_td(): bad x/y";

		if (foo === "") {
			td.style["background-image"] = "";
		} else if (foo === "b") {
			td.style["background-image"] = black_stone_url;
		} else if (foo === "w") {
			td.style["background-image"] = white_stone_url;
		} else {
			throw "set_td(): bad call";
		}

		this.table_state[x][y] = foo;
	},

	// --------------------------------------------------------------------------------------------
	// The 2 methods here are the main methods called by the hub...

	draw_standard: function(node) {

		this.draw_board(node.get_board());
		this.clear_ownership_canvas();

		if (node.has_valid_analysis() && node.analysis.ownership) {

			// If possible, use this node's analysis.

			this.plan_death_marks(node.get_board(), node.analysis.ownership, node.get_board().active);
			this.draw_ownership_canvas(node.analysis.ownership, node.get_board().active);

		} else if (hub.engine.desired && node_id_from_search_id(hub.engine.desired.id) === node.id) {

			// But to avoid flicker, we can use an older node's analysis.

			let analysis_node = node.ancestor_with_valid_analysis(8);
			if (analysis_node && analysis_node.analysis.ownership) {
				this.plan_death_marks(node.get_board(), analysis_node.analysis.ownership, analysis_node.get_board().active);
				this.draw_ownership_canvas(analysis_node.analysis.ownership, analysis_node.get_board().active);
			}

		}

		this.plan_ko_marker(node);
		this.plan_previous_markers(node);
		this.plan_shapes(node);
		this.plan_labels(node);
		this.plan_analysis_circles(node);
		this.plan_next_markers(node);					// Should be last, since it can adjust other planned objects.

		this.draw_canvas();
		this.draw_node_info(node);
		this.pv = null;
	},

	draw_pv: function(node, point) {					// Returns true / false indicating whether this happened.

		if (!point || !config.candidate_moves || !config.mouseover_pv || !node.has_valid_analysis()) {
			return false;
		}

		let startboard = node.get_board();
		let gtp = startboard.gtp(point);				// Gets a string like "K10" from the mouse point argument (which is like "jj").

		let info;

		for (let foo of moveinfo_filter(node)) {		// Of all the moves in our list, is one of them the one we're interested in?
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

		// We have a valid info, so the draw will proceed..........................................

		let finalboard = startboard.copy();
		let points = [];

		for (let move of info.pv.slice(0, config.analysis_pv_len)) {
			let s = finalboard.parse_gtp_move(move);	// "K10" --> "jj" (off-board becomes "")
			finalboard.play(s);
			points.push(s);								// Passes are included as "" (so our numbering works below)
		}

		this.draw_board(finalboard);
		this.clear_ownership_canvas();

		if (config.ownership_per_move && info.ownership) {
			this.plan_death_marks(finalboard, info.ownership, startboard.active);
			this.draw_ownership_canvas(info.ownership, startboard.active);
		} else if (node.analysis.ownership) {
			this.plan_death_marks(finalboard, node.analysis.ownership, startboard.active);
			this.draw_ownership_canvas(node.analysis.ownership, startboard.active);
		}

		this.plan_pv_labels(points);

		this.draw_canvas();
		this.draw_node_info(node, info);
		this.pv = points;

		return true;
	},

	// --------------------------------------------------------------------------------------------
	// Not to be called directly from the hub, these are mid-level helpers...

	draw_board: function(board) {

		this.rebuild_if_needed(board);

		// Aside from possibly triggering a rebuild, this function solely deals with TD elements...

		for (let x = 0; x < board.width; x++) {
			for (let y = 0; y < board.height; y++) {
				let desired = board.state[x][y];
				if (this.table_state[x][y] !== desired) {
					this.set_td(x, y, desired);
				}
			}
		}
	},

	draw_canvas: function() {

		// Based solely on whatever objects are in this.needed_marks...
		// All planning functions have to be called before this.

		let ctx = this.ctx;
		ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

		this.has_ownership_marks = false;

		for (let x = 0; x < this.width; x++) {
			for (let y = 0; y < this.height; y++) {
				let o = this.needed_marks[x][y];
				if (o) {
					this.draw_planned_canvas_object(o, x, y);
				}
				this.needed_marks[x][y] = null;		// Deleting items as they are drawn.
			}
		}
	},

	draw_planned_canvas_object(o, x, y) {

		// Assumes whatever board is being drawn has already been drawn,
		// therefore this.table_state is correct. Colours are mostly
		// determined based on what is actually drawn in the table.

		let tstate = this.table_state[x][y];
				
		switch (o.type) {

			case "analysis":

				this.wood(x, y);

				if (o.fill) {
					this.fcircle(x, y, 1, o.fill);
				}

				if (o.next_mark_colour) {
					this.circle(x, y, 0.085, 1, o.next_mark_colour);
				}

				if (o.text.length >= 3) {
					this.text_three(x, y, o.text[0], o.text[1], o.text[2], "#000000ff");
				} else if (o.text.length >= 2) {
					this.text_two(x, y, o.text[0], o.text[1], "#000000ff");
				} else if (o.text.length === 1) {
					this.text(x, y, o.text[0], "#000000ff");
				}

				break;

			case "ko":

				this.fcircle(x, y, 0.4, "#00000080");
				break;

			case "death":

				this.has_ownership_marks = true;
				this.fsquare(x, y, 1/6, mark_colour_from_state(tstate, "#00000080"));
				break;

			case "own":

				this.has_ownership_marks = true;
				this.fsquare(x, y, 1/3, o.colour);
				break;

			case "previous":

				this.fcircle(x, y, 0.4, config.previous_marker);
				break;

			case "pv":

				if (tstate !== "b" && tstate !== "w") {
					this.wood(x, y);
				}
				this.text(x, y, o.text, mark_colour_from_state(tstate, "#ff0000ff"));
				break;

			case "label":

				if (tstate !== "b" && tstate !== "w") {
					this.wood(x, y);
				}
				this.text(x, y, o.text, mark_colour_from_state(tstate, "#000000ff"));
				break;

			case "SQ":

				this.square(x, y, 0.085, 0.45, mark_colour_from_state(tstate, "#00000080"));
				break;

			case "CR":

				this.circle(x, y, 0.085, 0.55, mark_colour_from_state(tstate, "#00000080"));
				break;

			case "MA":

				this.cross(x, y, 0.085, 0.5, mark_colour_from_state(tstate, "#00000080"));
				break;

			case "TR":

				this.triangle(x, y, 0.085, 0.6, mark_colour_from_state(tstate, "#00000080"));
				break;
		}

		// If the object has a next_mark_colour flag, it's fine to draw it
		// at the end, except "analysis" objects need to finesse it...

		if (o.next_mark_colour && o.type !== "analysis") {
			this.circle(x, y, 0.085, 1, o.next_mark_colour);
		}

	},

	clear_ownership_canvas: function() {
		let ctx = this.ownerctx;
		ctx.clearRect(0, 0, this.ownercanvas.width, this.ownercanvas.height);
		this.wood_helps_are_valid = false;					// Always false unless the ownership canvas is actually drawn this cycle.
	},

	draw_ownership_canvas: function(ownership, ownership_perspective) {

		if (config.ownership_marks !== "Whole board" || !ownership) {
			return;
		}

		this.has_ownership_marks = true;					// FIXME - rename this variable, since ownership isn't "marks" now.
		this.wood_helps_are_valid = true;

		for (let x = 0; x < this.width; x++) {
			for (let y = 0; y < this.height; y++) {
				let own = ownership[x + (y * this.width)];
				if (ownership_perspective === "w") {
					own = -own;								// In this function we consider ownership from Black's POV.
				}

				let precomps = get_ownership_colours(own);
				this.fsquare(x, y, 1, precomps[0], true);
				this.wood_helps[x][y] = precomps[1];
			}
		}
	},

	// --------------------------------------------------------------------------------------------
	// Planning methods that add stuff to this.needed_marks to be drawn later. Doing it this way
	// helps avoid conflicts: i.e. 2 things won't be drawn at the same place, since only 1 thing
	// can be at each spot in the needed_marks array. We could also use a map of point --> object.

	plan_death_marks: function(board, ownership, ownership_perspective) {

		if (config.ownership_marks === "None" || !ownership) {
			return;
		}

		for (let x = 0; x < board.width; x++) {

			for (let y = 0; y < board.height; y++) {

				let state = board.state[x][y];

				if (state !== "b" && state !== "w") {
					continue;
				}

				let own = ownership[x + (y * board.width)];
				if (ownership_perspective === "w") {
					own = -own;								// In this function we consider ownership from Black's POV.
				}
				if (own > 0 && state === "w") {
					this.needed_marks[x][y] = {type: "death"};
				} else if (own < 0 && state === "b") {
					this.needed_marks[x][y] = {type: "death"};
				}
			}
		}
	},

	plan_pv_labels: function(points) {		// Where points is an array of the moves played in the PV, in order.

		for (let n = 0; n < points.length; n++) {

			let s = points[n];

			if (s.length === 2) {			// Otherwise, it's a pass and we don't draw it.

				let x = s.charCodeAt(0) - 97;
				let y = s.charCodeAt(1) - 97;

				if (x >= 0 && x < this.width && y >= 0 && y < this.height) {

					let o = this.needed_marks[x][y];

					if (o && o.type === "pv") {			// This is 2nd (or later) time this point is played on the PV.
						// o.text = "+";				// Bit of an aesthetic choice.
					} else {
						this.needed_marks[x][y] = {
							type: "pv",
							text: (n + 1).toString(),
						};
					}
				}
			}
		}
	},

	plan_ko_marker: function(node) {

		let board = node.get_board();

		if (board.ko) {
			let x = board.ko.charCodeAt(0) - 97;
			let y = board.ko.charCodeAt(1) - 97;
			this.needed_marks[x][y] = {type: "ko"};
		}
	},

	plan_previous_markers: function(node) {

		let moves_played = node.all_values("B").concat(node.all_values("W"));

		for (let s of moves_played) {			// Probably just one (but illegal SGF is possible).

			if (s.length === 2) {

				let x = s.charCodeAt(0) - 97;
				let y = s.charCodeAt(1) - 97;

				if (x >= 0 && x < this.width && y >= 0 && y < this.height) {
					this.needed_marks[x][y] = {type: "previous"};
				}
			}
		}
	},

	plan_analysis_circles: function(node) {
		
		if (!config.candidate_moves) {
			return;
		}

		let filtered_infos = moveinfo_filter(node);
		let board = node.get_board();
		let number_types = config.numbers.split(" + ");
		let got_bad_analysis_text = false;

		for (let info of filtered_infos) {

			let s = board.parse_gtp_move(info.move);

			if (s.length !== 2) {				// This is a pass.
				continue;
			}

			let x = s.charCodeAt(0) - 97;
			let y = s.charCodeAt(1) - 97;

			if (x >= 0 && x < board.width && y >= 0 && y < board.height) {

				let o = {
					type: "analysis",
					text: [],
					fill: null,
				};

				if (info.order === 0) {
					if (board.active === "b") o.fill = config.top_colour_black;
					if (board.active === "w") o.fill = config.top_colour_white;
				} else {
					let opacity_hex = config.visit_colours ? float_to_hex_ff(info.visits / filtered_infos[0].visits) : "ff";
					if (board.active === "b") o.fill = config.off_colour_black.slice(0, 7) + opacity_hex;
					if (board.active === "w") o.fill = config.off_colour_white.slice(0, 7) + opacity_hex;
				}

				for (let t of number_types) {
					let z = string_from_info(info, node, t);
					if (z === "?") {
						got_bad_analysis_text = true;
					}
					o.text.push(z);
				}

				this.needed_marks[x][y] = o;
			}
		}

		if (got_bad_analysis_text) {
			setTimeout(() => {					// Lame hack to fix bad values in config.json
				hub.cycle_numbers();
			}, 0);
		}
	},

	plan_shapes: function(node) {

		for (let key of ["MA", "TR", "SQ", "CR"]) {
			for (let val of node.all_values(key)) {
				for (let s of points_list(val)) {
					let x = s.charCodeAt(0) - 97;
					let y = s.charCodeAt(1) - 97;
					if (x >= 0 && x < this.width && y >= 0 && y < this.height) {
						this.needed_marks[x][y] = {type: key};
					}
				}
			}
		}
	},

	plan_labels: function(node) {

		for (let val of node.all_values("LB")) {

			if (val.length < 4) {
				continue;
			}

			let s = val.slice(0, 2);
			let text = val.slice(3).trim();

			let x = s.charCodeAt(0) - 97;
			let y = s.charCodeAt(1) - 97;

			if (x >= 0 && x < this.width && y >= 0 && y < this.height) {
				this.needed_marks[x][y] = {
					type: "label",
					text: text,
				};
			}
		}
	},

	plan_next_markers: function(node) {

		// Note that, since these can coincide with various things, if an object is already
		// present at the location, we simply add a next_mark_colour property to it. This
		// function should be called last of the planners.

		if (!config.next_move_markers) {
			return;
		}

		let board = node.get_board();

		for (let key of ["B", "W"]) {

			let draw_colour = (key === "B") ? "#00000080" : "#ffffffa0";

			for (let n = 0; n < node.children.length; n++) {

				let moves_played = node.children[n].all_values(key);

				for (let s of moves_played) {			// Probably just one per child.

					if (s.length === 2) {

						let x = s.charCodeAt(0) - 97;
						let y = s.charCodeAt(1) - 97;

						if (x >= 0 && x < board.width && y >= 0 && y < board.height) {

							if (this.needed_marks[x][y]) {
								if (!this.needed_marks[x][y].next_mark_colour) {
									this.needed_marks[x][y].next_mark_colour = draw_colour;
								} else {
									// We already have this mark due to some sibling, do nothing.
								}
							} else {
								this.needed_marks[x][y] = {
									type: "next",
									next_mark_colour: draw_colour,
								};
							}
						}
					}
				}
			}
		}
	},

	// --------------------------------------------------------------------------------------------

	draw_node_info: function(node, override_moveinfo) {

		if (hub.engine.problem_text()) {
			this.draw_engine_problem();
			return;
		}

		let board = node.get_board();

		let last_move = "";
		let last_move_props = node.all_values("B").concat(node.all_values("W"));
		if (last_move_props.length === 1) {
			last_move = board.gtp(last_move_props[0]);
		}

		let numbers_string = "(hidden)";
		if (config.candidate_moves) {
			numbers_string = config.numbers.split(" + ").join(", ");
		}

		let s = "";

		s += `<span class="boardinfo_rules">Rules: <span class="white">${pad(board.rules, 16)}</span></span>`;
		s += `<span class="boardinfo_komi">Komi: <span class="white">${pad(board.komi, 8)}</span></span>`;
		s += `Prev: <span class="white">${pad(last_move, 6)}</span>`;
		s += `<span class="boardinfo_numbers">Show: <span class="white">${pad(numbers_string, 19)}</span></span>`;

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
		s += `${override_moveinfo ? "This" : "Best"}: <span class="white">${pad(move, 6)}</span>`;
		s += `Visits: <span class="white">${pad(visits, 15)}</span>`;

		this.infodiv.innerHTML = s;
	},

	draw_engine_problem: function() {
		let s = hub.engine.problem_text();
		this.infodiv.innerHTML = `<span class="white">${s}<br>Resolve this via the Setup menu.</span>`;
	},

};

// ------------------------------------------------------------------------------------------------

function mark_colour_from_state(state, dflt) {
	if (!dflt) throw "mark_colour_from_state(): bad call";
	if (state === "b") return "#ffffffff";
	if (state === "w") return "#000000ff";
	return dflt;
}

function string_from_info(info, node, type) {

	let val;			// It seems using let inside a switch is dubious.
	let text;
	let absl;

	switch (type) {

		case "Winrate":
			return Math.floor(Math.max(0, info.winrate * 100)).toString();
		case "LCB":
			return Math.floor(Math.max(0, info.lcb * 100)).toString();
		case "Visits (%)":
			return Math.floor(info.visits / node.analysis.rootInfo.visits * 100).toString();
		case "Policy":
			return Math.floor(info.prior * 100).toString();
		case "Score":
			val = info.scoreLead;
			text = val < 0 ? "-" : "+";
			absl = Math.abs(val);
			if (absl < 10) {
				text += absl.toFixed(1);
				if (text === "-10.0") text = "-10";
				if (text === "+10.0") text = "+10";
			} else {
				text += Math.floor(absl);
			}
			return text;
		case "Delta":
			val = info.scoreLead - node.analysis.moveInfos[0].scoreLead;
			text = val < 0 ? "-" : "+";
			absl = Math.abs(val);
			if (absl < 10) {
				text += absl.toFixed(1);
				if (text === "-10.0") text = "-10";
				if (text === "+10.0") text = "+10";
				if (text === "+0.0" || text === "-0.0") text = "0";
			} else {
				text += Math.floor(absl);
			}
			return text;
		case "Visits":
			if (info.visits > 9950) {
				return (info.visits / 1000).toFixed(0) + "k";
			} else if (info.visits > 999) {
				return (info.visits / 1000).toFixed(1) + "k";
			}
			return info.visits.toString();
		case "Order":
			return info.order.toString();
		default:
			return "?";
	}
}



module.exports = init();
