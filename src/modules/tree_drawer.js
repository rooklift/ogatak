"use strict";

function new_tree_drawer(canvas, boardcanvas) {
	let drawer = Object.create(tree_drawer_prototype);
	drawer.canvas = canvas;
	drawer.boardcanvas = boardcanvas;
	return drawer;
}

let tree_drawer_prototype = {

	draw_tree: function() {

		this.canvas.width = Math.max(64, window.innerWidth - this.canvas.getBoundingClientRect().left);
		this.canvas.height = this.boardcanvas.height + 128;

		let ctx = this.canvas.getContext("2d");

		ctx.fillStyle = "#333333ff";
		ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
	}

};



module.exports = new_tree_drawer;
