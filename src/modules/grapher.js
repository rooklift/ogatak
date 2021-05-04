"use strict";

const draw_y_offset = 5;

function new_graph_drawer(outerdiv, canvas) {
	let drawer = Object.create(graph_drawer_prototype);
	drawer.outerdiv = outerdiv;
	drawer.canvas = canvas;
	drawer.drawable_height = 0;
	return drawer;
}

let graph_drawer_prototype = {

	draw: function(node) {

		this.canvas.width = Math.max(64, window.innerWidth - this.canvas.getBoundingClientRect().left - 16);
		this.canvas.height = this.outerdiv.offsetHeight;

		this.drawable_height = this.canvas.height - (draw_y_offset * 2);		// Don't draw at the very top and bottom of the canvas.

		let ctx = this.canvas.getContext("2d");

		let history = node.get_end().history();

		let scores = [];
		let winrates = [];

		let abs_score_max = 5;		// To start with, means our score graph will have at least axis -5 to 5.

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
		ctx.beginPath();

		for (let n = 0; n < vals.length; n++) {

			if (vals[n] === null) {
				continue;
			}

			let val = vals[n];

			let fraction = (val + max_val) / (max_val * 2);

			let gx = this.canvas.width * fraction;
			let gy = (this.drawable_height * n / graph_length) + draw_y_offset;

			if (!started) {
				ctx.moveTo(gx, gy);
				started = true;
			} else {
				ctx.lineTo(gx, gy);
			}
		}

		ctx.stroke();
	},
};



module.exports = new_graph_drawer;
