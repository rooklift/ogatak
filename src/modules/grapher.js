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

	reset_grapher: function(node) {

		this.line_end = node.get_end();
		this.is_entirely_main_line = this.line_end.is_main_line();

		this.canvas.width = this.positioncanvas.width = config.graph_width;
		this.canvas.height = this.positioncanvas.height = board_drawer.canvas.height + 48;

		let visible_width = Math.max(0, Math.min(this.canvas.width, window.innerWidth - this.canvas.getBoundingClientRect().left));

		this.draw_x_offset = 16;
		this.draw_y_offset = config.square_size / 4;
		this.drawable_width = Math.max(0, visible_width - (this.draw_x_offset * 2));
		this.drawable_height = Math.max(0, board_drawer.canvas.height - (config.square_size / 2));
	},

	draw_graph: function(node) {

		this.reset_grapher(node);

		if (this.too_small_to_draw()) {
			return;
		}

		let history = this.line_end.history();

		let scores = [];									// 0 to 1 from Black's POV (after manipulations)
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

		// Normalise our scores to the 0..1 range...

		for (let n = 0; n < scores.length; n++) {
			if (scores[n] !== null) {
				scores[n] = (scores[n] + abs_score_max) / (abs_score_max * 2);
			}
		}

		// With everything we need present in the arrays, we can draw...

		let major_colour = this.is_entirely_main_line ? config.major_graph_colour : config.major_graph_var_colour;

		this.__draw_midline();

		if (config.graph_type === "Score") {
			this.__draw_tracker(node, winrates, config.minor_graph_linewidth, config.minor_graph_colour);
			this.__draw_tracker(node, scores, config.major_graph_linewidth, major_colour);
		} else if (config.graph_type === "Winrate") {
			this.__draw_tracker(node, scores, config.minor_graph_linewidth, config.minor_graph_colour);
			this.__draw_tracker(node, winrates, config.major_graph_linewidth, major_colour);
		}

		this.draw_position(node, true);

	},

	__draw_tracker: function(node, vals, linewidth, colour) {

		// Assumes vals are normalised to 0..1 range

		let ctx = this.ctx;
		ctx.lineWidth = linewidth;
		ctx.strokeStyle = colour;

		let graph_depth = node.graph_depth_knower.val;

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
			let gy = this.draw_y_offset + (this.drawable_height * n / graph_depth);

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
					let gy = this.draw_y_offset + (this.drawable_height * (n - 1) / graph_depth);

					ctx.beginPath();
					ctx.moveTo(gx, gy);
					started = true;
				}

			} else {

				seen_real_value = true;

				if (started) {

					let gx = this.draw_x_offset + (this.drawable_width * vals[n]);
					let gy = this.draw_y_offset + (this.drawable_height * n / graph_depth);

					ctx.lineTo(gx, gy);
					ctx.stroke();
					started = false;
				}
			}
		}

		ctx.setLineDash([]);
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

	draw_position: function(node, skip_blanking = false) {

		let ctx = this.posctx;

		if (!skip_blanking) {
			ctx.clearRect(0, 0, this.positioncanvas.width, this.positioncanvas.height);
		}

		if (this.too_small_to_draw()) {
			return;
		}

		let graph_depth = node.graph_depth_knower.val;

		// Position marker...

		ctx.lineWidth = config.major_graph_linewidth;
		ctx.strokeStyle = this.is_entirely_main_line ? config.major_graph_colour : config.major_graph_var_colour;	// Cached so we don't need to work it out.
		ctx.setLineDash([config.major_graph_linewidth, config.major_graph_linewidth * 2]);

		ctx.beginPath();
		ctx.moveTo(
			this.draw_x_offset + (this.drawable_width / 2) - config.major_graph_linewidth,
			this.draw_y_offset + (node.depth / graph_depth * this.drawable_height));
		ctx.lineTo(
			this.draw_x_offset,
			this.draw_y_offset + (node.depth / graph_depth * this.drawable_height));
		ctx.stroke();

		ctx.beginPath();
		ctx.moveTo(
			this.draw_x_offset + (this.drawable_width / 2) + config.major_graph_linewidth,
			this.draw_y_offset + (node.depth / graph_depth * this.drawable_height));
		ctx.lineTo(
			this.draw_x_offset + this.drawable_width,
			this.draw_y_offset + (node.depth / graph_depth * this.drawable_height));
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
			this.draw_y_offset + (this.drawable_height * node.depth / graph_depth) + 4
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

		let click_depth = Math.round(node.graph_depth_knower.val * mousey / this.drawable_height);

		if (click_depth < 0) click_depth = 0;
		if (click_depth >= node_list.length) click_depth = node_list.length - 1;

		return node_list[click_depth];
	},
};



module.exports = init();
