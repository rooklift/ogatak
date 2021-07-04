"use strict";

function new_grapher(canvas, positioncanvas, board_drawer) {	// board_drawer object provided so we can match its height; not used otherwise.

	let drawer = Object.create(graph_drawer_prototype);

	drawer.canvas = canvas;
	drawer.positioncanvas = positioncanvas;
	drawer.board_drawer = board_drawer;

	drawer.draw_x_offset = 0;									// These are all to
	drawer.draw_y_offset = 0;									// be set later.
	drawer.drawable_width = 0;
	drawer.drawable_height = 0;

	drawer.line_end = null;
	drawer.major_colour = config.major_graph_colour;			// Cached so draw_position() knows what colour to use cheaply.

	return drawer;
}

let graph_drawer_prototype = {

	correct_width: function() {
		return Math.max(0, Math.min(config.graph_width, window.innerWidth - this.canvas.getBoundingClientRect().left));
	},

	correct_height: function() {
		return this.board_drawer.canvas.height + 128;
	},

	has_correct_size: function() {
		return this.canvas.width === this.correct_width() && this.canvas.height === this.correct_height();
	},

	draw_graph: function(node) {

		this.line_end = node.get_end();		// Set this now, before any early returns.

		this.canvas.width = this.correct_width();
		this.canvas.height = this.correct_height();

		this.draw_x_offset = 16;
		this.draw_y_offset = this.board_drawer.canvas.getBoundingClientRect().top - this.canvas.getBoundingClientRect().top + (config.square_size / 4);

		this.drawable_width = Math.max(0, this.canvas.width - (this.draw_x_offset * 2));
		this.drawable_height = Math.max(0, this.board_drawer.canvas.height - (config.square_size / 2));

		if (this.drawable_width <= 16 || this.drawable_height <= 0) {
			this.draw_position(node);		// Just so it sets its size.
			return;
		}

		let ctx = this.canvas.getContext("2d");

		let history = this.line_end.history();

		let scores = [];
		let winrates = [];

		let abs_score_max = 5;				// To start with, means our score graph will have at least axis -5 to 5.

		for (let h_node of history) {

			if (h_node.has_valid_analysis()) {

				let score = h_node.analysis.moveInfos[0].scoreLead;
				let winrate = h_node.analysis.moveInfos[0].winrate;

				if (h_node.get_board().active === "w") {
					score = score * -1;
					winrate = 1 - winrate;
				}

				if (Math.abs(score) > abs_score_max) {
					abs_score_max = Math.abs(score);
				}

				if (winrate < 0) winrate = 0;
				if (winrate > 1) winrate = 1;

				winrate = (winrate - 0.5) * 2;				// Rescale to -1..1, our draw code likes symmetry around zero.

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
						winrate = (winrate - 0.5) * 2;		// Rescale to -1..1, our draw code likes symmetry around zero.
					} else {
						winrate = null;
					}
				}

				winrates.push(winrate);
			}
		}

		// 50% line...

		ctx.lineWidth = config.minor_graph_linewidth;
		ctx.strokeStyle = config.midline_graph_colour;

		ctx.beginPath();
		ctx.moveTo(this.canvas.width / 2, this.draw_y_offset);
		ctx.lineTo(this.canvas.width / 2, this.drawable_height + this.draw_y_offset);
		ctx.stroke();

		// First the minor draw, i.e. the darker gray line...

		ctx.strokeStyle = config.minor_graph_colour;

		if (config.graph_type === "score") {
			this.__draw_vals(winrates, 1, node.graph_length_knower.val, config.minor_graph_linewidth);
		} else {
			this.__draw_vals(scores, abs_score_max, node.graph_length_knower.val, config.minor_graph_linewidth);
		}

		// Next the major draw, i.e. the brighter line...
		// We cache the colour we use so that draw_position() can cheaply know what colour it should use.

		this.major_colour = history[history.length - 1].is_main_line() ? config.major_graph_colour : config.major_graph_var_colour;
		ctx.strokeStyle = this.major_colour;

		if (config.graph_type === "score") {
			this.__draw_vals(scores, abs_score_max, node.graph_length_knower.val, config.major_graph_linewidth);
		} else {
			this.__draw_vals(winrates, 1, node.graph_length_knower.val, config.major_graph_linewidth);
		}

		// Then the position line on top...

		this.draw_position(node);

	},

	draw_position: function(node) {

		// Clear the position canvas, while also making sure it's the right size...

		this.positioncanvas.width = this.canvas.width;
		this.positioncanvas.height = this.canvas.height;

		if (this.drawable_width <= 16 || this.drawable_height <= 0) {
			return;
		}

		let ctx = this.positioncanvas.getContext("2d");

		// Position marker...

		ctx.lineWidth = config.major_graph_linewidth;
		ctx.strokeStyle = this.major_colour;													// Cached from last full draw, so we don't need to work it out.
		ctx.setLineDash([config.major_graph_linewidth, config.major_graph_linewidth * 2]);

		ctx.beginPath();
		ctx.moveTo(this.positioncanvas.width / 2 - config.major_graph_linewidth,
			node.depth / node.graph_length_knower.val * this.drawable_height + this.draw_y_offset);
		ctx.lineTo(this.draw_x_offset,
			node.depth / node.graph_length_knower.val * this.drawable_height + this.draw_y_offset);
		ctx.stroke();

		ctx.beginPath();
		ctx.moveTo(this.positioncanvas.width / 2 + config.major_graph_linewidth,
			node.depth / node.graph_length_knower.val * this.drawable_height + this.draw_y_offset);
		ctx.lineTo(this.canvas.width - this.draw_x_offset,
			node.depth / node.graph_length_knower.val * this.drawable_height + this.draw_y_offset);
		ctx.stroke();

		ctx.setLineDash([]);

		// Move number...

		ctx.fillStyle = "#000000ff";
		ctx.textAlign = "right";
		ctx.textBaseline = "top";
		ctx.font = `${config.info_font_size}px Courier New`;
		ctx.fillText(node.depth.toString(),
			this.canvas.width - this.draw_x_offset,
			node.depth / node.graph_length_knower.val * this.drawable_height + this.draw_y_offset + 4);
	},

	__draw_vals: function(vals, max_val, graph_length, linewidth) {

		let ctx = this.canvas.getContext("2d");
		ctx.lineWidth = linewidth;

		let started = false;

		for (let n = 0; n <= vals.length; n++) {				// Deliberate "out-by-1 error", so we end on a missing value.

			if (vals[n] === null || vals[n] === undefined) {
				if (started) {
					ctx.stroke();
					started = false;
				}
				continue;
			}

			let val = vals[n];
			let fraction = (val + max_val) / (max_val * 2);

			let gx = (this.drawable_width * fraction) + this.draw_x_offset;
			let gy = (this.drawable_height * n / graph_length) + this.draw_y_offset;

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

		this.__draw_interpolations(vals, max_val, graph_length, linewidth);
	},

	__draw_interpolations: function(vals, max_val, graph_length, linewidth) {

		let ctx = this.canvas.getContext("2d");
		ctx.lineWidth = linewidth;
		ctx.setLineDash([linewidth, linewidth * 2]);

		let started = false;
		let seen_real_value = false;

		for (let n = 0; n < vals.length; n++) {

			if (typeof vals[n] !== "number") {

				if (!seen_real_value) {
					continue;
				}

				if (!started) {

					let val = vals[n - 1];
					let fraction = (val + max_val) / (max_val * 2);
					let gx = (this.drawable_width * fraction) + this.draw_x_offset;
					let gy = (this.drawable_height * (n - 1) / graph_length) + this.draw_y_offset;

					ctx.beginPath();
					ctx.moveTo(gx, gy);
					started = true;
				}

			} else {

				seen_real_value = true;

				if (started) {

					let val = vals[n];
					let fraction = (val + max_val) / (max_val * 2);
					let gx = (this.drawable_width * fraction) + this.draw_x_offset;
					let gy = (this.drawable_height * n / graph_length) + this.draw_y_offset;

					ctx.lineTo(gx, gy);
					ctx.stroke();
					started = false;
				}
			}
		}

		ctx.setLineDash([]);
	},

	node_from_click: function(node, event) {

		if (!event || !this.drawable_height) {
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



module.exports = new_grapher;
