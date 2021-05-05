"use strict";

const draw_y_offset = 5;

function new_graph_drawer(canvas, positioncanvas) {
	let drawer = Object.create(graph_drawer_prototype);
	drawer.canvas = canvas;
	drawer.positioncanvas = positioncanvas;
	drawer.drawable_height = 0;
	return drawer;
}

let graph_drawer_prototype = {

	draw_graph: function(node) {		// Not named "draw" so that we can tell it apart in the Chrome performance tab.

		this.canvas.width = Math.max(64, window.innerWidth - this.canvas.getBoundingClientRect().left - 16);
		this.canvas.height = Math.max(64, window.innerHeight - this.canvas.getBoundingClientRect().top - 16);

		this.drawable_height = this.canvas.height - (draw_y_offset * 2);		// Don't draw at the very top and bottom of the canvas.

		let ctx = this.canvas.getContext("2d");

		let history = node.get_end().history();

		let scores = [];
		let winrates = [];

		let abs_score_max = 5;			// To start with, means our score graph will have at least axis -5 to 5.

		for (let node of history) {

			if (node.has_valid_analysis()) {

				let score = node.analysis.moveInfos[0].scoreLead;
				let winrate = node.analysis.moveInfos[0].winrate;

				if (node.get_board().active === "w") {
					score = score * -1;
					winrate = 1 - winrate;
				}

				if (Math.abs(score) > abs_score_max) {
					abs_score_max = Math.abs(score);
				}

				if (winrate < 0) winrate = 0;
				if (winrate > 1) winrate = 1;

				winrate = (winrate - 0.5) * 2;		// Rescale to -1..1, our draw code likes symmetry around zero.

				scores.push(score);
				winrates.push(winrate);
			} else {
				scores.push(null);
				winrates.push(null);
			}
		}

		if (config.graph_type === "score") {

			ctx.lineWidth = 1;
			ctx.strokeStyle = "#222222ff";
			this.__draw_vals(winrates, 1, node.graph_length_knower.val);

			ctx.lineWidth = 2;
			ctx.strokeStyle = "#999999ff";
			this.__draw_vals(scores, abs_score_max, node.graph_length_knower.val);

		} else if (config.graph_type === "winrate") {

			ctx.lineWidth = 1;
			ctx.strokeStyle = "#222222ff";
			this.__draw_vals(scores, abs_score_max, node.graph_length_knower.val);

			ctx.lineWidth = 2;
			ctx.strokeStyle = "#999999ff";
			this.__draw_vals(winrates, 1, node.graph_length_knower.val);
		}

		this.draw_position(node);

	},

	draw_position: function(node) {

		if (!this.drawable_height) {
			return;
		}

		let ctx = this.positioncanvas.getContext("2d");

		this.positioncanvas.width = this.canvas.width;
		this.positioncanvas.height = this.canvas.height;

		ctx.lineWidth = 2;
		ctx.strokeStyle = "#6ccceeff";
		ctx.setLineDash([2, 4]);

		ctx.beginPath();
		ctx.moveTo(0, (node.depth / node.graph_length_knower.val * this.drawable_height) + draw_y_offset);
		ctx.lineTo(this.canvas.width, (node.depth / node.graph_length_knower.val * this.drawable_height) + draw_y_offset);
		ctx.stroke();

		ctx.setLineDash([]);
	},

	__draw_vals: function(vals, max_val, graph_length) {

		let ctx = this.canvas.getContext("2d");

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
			let gx = this.canvas.width * fraction;
			let gy = (this.drawable_height * n / graph_length) + draw_y_offset;

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

		this.__draw_interpolations(vals, max_val, graph_length);
	},

	__draw_interpolations: function(vals, max_val, graph_length) {

		let ctx = this.canvas.getContext("2d");
		ctx.setLineDash([2, 4]);

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
					let gx = this.canvas.width * fraction;
					let gy = (this.drawable_height * (n - 1) / graph_length) + draw_y_offset;

					ctx.beginPath();
					ctx.moveTo(gx, gy);
					started = true;
				}

			} else {

				seen_real_value = true;

				if (started) {

					let val = vals[n];
					let fraction = (val + max_val) / (max_val * 2);
					let gx = this.canvas.width * fraction;
					let gy = (this.drawable_height * n / graph_length) + draw_y_offset;

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

		mousey -= draw_y_offset;
		if (mousey < 0) mousey = 0;

		let node_list = node.get_end().history();

		let click_depth = Math.round(node.graph_length_knower.val * mousey / this.drawable_height);

		if (click_depth < 0) click_depth = 0;
		if (click_depth >= node_list.length) click_depth = node_list.length - 1;

		return node_list[click_depth];
	},
};



module.exports = new_graph_drawer;
