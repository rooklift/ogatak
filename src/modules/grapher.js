"use strict";

function init() {

	return Object.assign(Object.create(grapher_prototype), {

		canvas: document.getElementById("graphcanvas"),
		positioncanvas: document.getElementById("graphpositioncanvas"),
		
		ctx: document.getElementById("graphcanvas").getContext("2d"),
		posctx: document.getElementById("graphpositioncanvas").getContext("2d"),

		draw_x_offset: 0,									// These are all to be set later. Every coordinate is based
		draw_y_offset: 0,									// on the drawable sizes, then shifted by the offsets.
		drawable_width: 0,
		drawable_height: 0,

		line_end: null,
		is_entirely_main_line: false,						// Cached so draw_position() knows what colour to use cheaply.

	});
}

let grapher_prototype = {

	too_small_to_draw: function() {
		return this.drawable_width < 24 || this.drawable_height < 24;
	},

	draw_graph: function(node) {

		this.line_end = node.get_end();									// Set these now, before
		this.is_entirely_main_line = this.line_end.is_main_line();		// any early returns...

		this.canvas.width = config.graph_width;
		this.canvas.height = board_drawer.canvas.height + 48;

		this.draw_x_offset = 16;
		this.draw_y_offset = config.square_size / 4;

		let visible_width = Math.max(0, Math.min(this.canvas.width, window.innerWidth - this.canvas.getBoundingClientRect().left));

		this.drawable_width = Math.max(0, visible_width - (this.draw_x_offset * 2));
		this.drawable_height = Math.max(0, board_drawer.canvas.height - (config.square_size / 2));

		if (this.too_small_to_draw()) {
			this.draw_position(node);						// Just so it sets its size.
			return;
		}

		// The real work...

		let ctx = this.ctx;
		let history = this.line_end.history();

		let scores = [];									// 0 to 1 from Black's POV
		let winrates = [];									// 0 to 1 from Black's POV

		let abs_score_max = 5;

		for (let h_node of history) {

			if (h_node.has_valid_analysis()) {

				let score = h_node.analysis.moveInfos[0].scoreLead;
				let winrate = h_node.analysis.moveInfos[0].winrate;

				if (h_node.get_board().active === "w") {
					score = score * -1;
					winrate = 1 - winrate;
				}

				if ( score > abs_score_max) abs_score_max =  score;
				if (-score > abs_score_max) abs_score_max = -score;

				if (winrate < 0) winrate = 0;
				if (winrate > 1) winrate = 1;

				scores.push(score);
				winrates.push(winrate);

			} else {

				scores.push(null);

				let sbkv = h_node.get("SBKV");
				let winrate = null;

				if (sbkv) {
					winrate = parseFloat(sbkv);
					if (Number.isNaN(winrate) === false) {
						winrate /= 100;
					} else {
						winrate = null;
					}
				}

				winrates.push(winrate);
			}
		}

		// Normalise our scores to the 0..1 range as well...

		for (let n = 0; n < scores.length; n++) {
			if (scores[n] !== null) {
				scores[n] = (scores[n] + abs_score_max) / (abs_score_max * 2);
			}
		}

		// With everything we need present in the arrays, we can draw...

		this.__draw_midline();

		if (config.graph_type === "Score") {
			this.__draw_swings(node, scores, config.minor_graph_linewidth, config.minor_graph_colour);
			this.__draw_tracker(node, scores, config.major_graph_linewidth, config.major_graph_colour);
		} else if (config.graph_type === "Winrate") {
			this.__draw_swings(node, winrates, config.minor_graph_linewidth, config.minor_graph_colour);
			this.__draw_tracker(node, winrates, config.major_graph_linewidth, config.major_graph_colour);
		}

		this.draw_position(node);

	},

	__draw_tracker: function(node, vals, linewidth, colour) {

		// Assumes vals are normalised to -1..1 range

		let ctx = this.ctx;
		ctx.lineWidth = linewidth;
		ctx.strokeStyle = colour;

		let graph_length = node.graph_length_knower.val;

		// Draw solid portions.....................................................................

		let started = false;

		for (let n = 0; n <= vals.length; n++) {				// Deliberate "out-by-1 error", so we end on a missing value.

			if (vals[n] === null || vals[n] === undefined) {
				if (started) {
					ctx.stroke();
					started = false;
				}
				continue;
			}

			let gx = this.draw_x_offset + (this.drawable_width * vals[n]);
			let gy = this.draw_y_offset + (this.drawable_height * n / graph_length);

			if (!started) {
				if (typeof vals[n + 1] === "number") {
					ctx.beginPath();
					ctx.moveTo(gx, gy);
					started = true;
				}
			} else {
				ctx.lineTo(gx, gy);
			}
		}

		// Draw interpolations.....................................................................

		ctx.setLineDash([linewidth, linewidth * 2]);

		started = false;
		let seen_real_value = false;

		for (let n = 0; n < vals.length; n++) {

			if (typeof vals[n] !== "number") {

				if (!seen_real_value) {
					continue;
				}

				if (!started) {

					let gx = this.draw_x_offset + (this.drawable_width * vals[n - 1]);
					let gy = this.draw_y_offset + (this.drawable_height * (n - 1) / graph_length);

					ctx.beginPath();
					ctx.moveTo(gx, gy);
					started = true;
				}

			} else {

				seen_real_value = true;

				if (started) {

					let gx = this.draw_x_offset + (this.drawable_width * vals[n]);
					let gy = this.draw_y_offset + (this.drawable_height * n / graph_length);

					ctx.lineTo(gx, gy);
					ctx.stroke();
					started = false;
				}
			}
		}

		ctx.setLineDash([]);
	},

	__draw_swings: function(node, vals, linewidth, colour) {

		let graph_length = node.graph_length_knower.val;

		let deltas = [];

		for (let n = 0; n < vals.length; n++) {
			if (typeof vals[n - 1] === "number" && typeof vals[n] === "number") {
				let d = vals[n] - vals[n - 1];
				deltas.push(d);
			} else {
				deltas.push(0);
			}
		}

		// Draw...

		let ctx = this.ctx;
		ctx.lineWidth = linewidth;
		ctx.strokeStyle = colour;

		for (let n = 0; n < deltas.length; n++) {

			if (!deltas[n]) continue;

			let gx = this.draw_x_offset + (this.drawable_width * 0.5);
			let gy = this.draw_y_offset + (this.drawable_height * n / graph_length);

			ctx.beginPath();
			ctx.moveTo(gx, gy);

			ctx.lineTo(gx + (deltas[n] * this.drawable_width), gy);
			ctx.stroke();
		}
	},

	__draw_midline: function() {

		let ctx = this.ctx;

		ctx.lineWidth = config.minor_graph_linewidth;
		ctx.strokeStyle = config.midline_graph_colour;

		ctx.beginPath();
		ctx.moveTo(
			this.draw_x_offset + (this.drawable_width / 2),
			this.draw_y_offset
		);
		ctx.lineTo(
			this.draw_x_offset + (this.drawable_width / 2),
			this.draw_y_offset + this.drawable_height
		);
		ctx.stroke();

	},

	draw_position: function(node) {

		// Clear the position canvas, while also making sure it's the right size...

		this.positioncanvas.width = this.canvas.width;
		this.positioncanvas.height = this.canvas.height;

		if (this.too_small_to_draw()) {
			return;
		}

		let ctx = this.posctx;
		let graph_length = node.graph_length_knower.val;

		// Position marker...

		ctx.lineWidth = config.major_graph_linewidth;
		ctx.strokeStyle = this.is_entirely_main_line ? config.major_graph_colour : config.major_graph_var_colour;	// Cached so we don't need to work it out.
		ctx.setLineDash([config.major_graph_linewidth, config.major_graph_linewidth * 2]);

		ctx.beginPath();
		ctx.moveTo(
			this.draw_x_offset + (this.drawable_width / 2) - config.major_graph_linewidth,
			this.draw_y_offset + (node.depth / graph_length * this.drawable_height));
		ctx.lineTo(
			this.draw_x_offset,
			this.draw_y_offset + (node.depth / graph_length * this.drawable_height));
		ctx.stroke();

		ctx.beginPath();
		ctx.moveTo(
			this.draw_x_offset + (this.drawable_width / 2) + config.major_graph_linewidth,
			this.draw_y_offset + (node.depth / graph_length * this.drawable_height));
		ctx.lineTo(
			this.draw_x_offset + this.drawable_width,
			this.draw_y_offset + (node.depth / graph_length * this.drawable_height));
		ctx.stroke();

		ctx.setLineDash([]);

		// Move number...

		ctx.fillStyle = "#ffffffff";
		ctx.textAlign = "right";
		ctx.textBaseline = "top";
		ctx.font = `${config.info_font_size}px Courier New`;
		ctx.fillText(
			node.depth.toString(),
			this.draw_x_offset + this.drawable_width,
			this.draw_y_offset + (this.drawable_height * node.depth / graph_length) + 4
		);
	},

	node_from_click: function(node, event) {

		if (!event || this.too_small_to_draw()) {
			return null;
		}

		let mousey = event.offsetY;
		if (typeof mousey !== "number") {
			return null;
		}

		mousey -= this.draw_y_offset;
		if (mousey < 0) mousey = 0;

		let node_list = node.get_end().history();

		let click_depth = Math.round(node.graph_length_knower.val * mousey / this.drawable_height);

		if (click_depth < 0) click_depth = 0;
		if (click_depth >= node_list.length) click_depth = node_list.length - 1;

		return node_list[click_depth];
	},
};



module.exports = init();
