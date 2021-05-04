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
		let vals = [];

		for (let node of history) {
			if (node.has_valid_analysis()) {
				let val = node.analysis.moveInfos[0].winrate;
				if (node.get_board().active === "w") val = 1 - val;
				if (val < 0) val = 0;
				if (val > 1) val = 1;
				vals.push(val);
			} else {
				vals.push(null);
			}
		}

		ctx.strokeStyle = "#999999ff";
		ctx.lineWidth = 2;

		let started = false;
		ctx.beginPath();

		for (let n = 0; n < vals.length; n++) {

			if (vals[n] === null) {
				continue;
			}

			let val = vals[n];
			let gx = this.canvas.width * val;
			let gy = this.canvas.height * n / node.graph_length_knower.val;

			if (!started) {
				ctx.moveTo(gx, gy);
				started = true;
			} else {
				ctx.lineTo(gx, gy);
			}
		}

		ctx.stroke();
	}
};



module.exports = new_graph_drawer;
