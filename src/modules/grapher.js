"use strict";

function new_graph_drawer(outerdiv, canvas) {
	let drawer = Object.create(graph_drawer_prototype);
	drawer.outerdiv = outerdiv;
	drawer.canvas = canvas;
	return drawer;
}

let graph_drawer_prototype = {

	// FIXME - the outerdiv can get bigger but it's impossible to make it smaller.

	draw: function(node) {

		this.canvas.width = this.outerdiv.offsetWidth;				// I think just setting the width
		this.canvas.height = this.outerdiv.offsetHeight;			// and height is enough to clear it.

		let ctx = this.canvas.getContext("2d");

		let history = node.get_end().history();

		let scores = [];
		let winrates = [];

		let abs_score_max = 0;

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

		ctx.lineWidth = 2;
		ctx.strokeStyle = "#999999ff";

		if (config.graph_type === "score") {
			this.__draw_vals(scores, abs_score_max, node.graph_length_knower.val);
		} else if (config.graph_type === "winrate") {
			this.__draw_vals(winrates, 1, node.graph_length_knower.val);
		}

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
			let gy = this.canvas.height * n / graph_length;

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
