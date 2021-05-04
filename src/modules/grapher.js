"use strict";

function new_graph_drawer(outerdiv, canvas) {
	let drawer = Object.create(graph_drawer_prototype);
	drawer.outerdiv = outerdiv;
	drawer.canvas = canvas;
	return drawer;
}

let graph_drawer_prototype = {

	draw: function() {

		this.canvas.width = this.outerdiv.offsetWidth;		// I think just setting the width
		this.canvas.height = this.outerdiv.offsetHeight;	// and height is enough to clear it.

	}
}



module.exports = new_graph_drawer;
