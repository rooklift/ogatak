"use strict";

function new_tree_drawer(canvas, boardcanvas) {
	let drawer = Object.create(tree_drawer_prototype);
	drawer.canvas = canvas;
	drawer.boardcanvas = boardcanvas;
	return drawer;
}

let tree_drawer_prototype = {

	draw_tree: function(central_node) {

		this.canvas.width = Math.max(64, window.innerWidth - this.canvas.getBoundingClientRect().left);
		this.canvas.height = this.boardcanvas.height;

		let root = central_node.get_root();

		reserver(root, []);
		this.__draw(root, central_node);
	},

	__draw: function(local_root, central_node) {

		let ctx = this.canvas.getContext("2d");

		let node = local_root;

		while (true) {

			let dx = node.graphx - central_node.graphx;
			let dy = node.depth - central_node.depth;

			let gx = (this.canvas.width / 2) + (dx * 16);
			let gy = (this.canvas.height / 2) + (dy * 16);

			ctx.fillStyle = node === central_node ? "#ffffffff" : "#4ba28bff";

			ctx.beginPath();
			ctx.arc(gx, gy, 3, 0, 2 * Math.PI);
			ctx.fill();

			if (node.children.length > 1) {
				for (let child of node.children) {
					this.__draw(child, central_node);
				}
				break;
			} else if (node.children.length === 1) {
				node = node.children[0];
				continue;
			} else {
				break;
			}
		}
	},
};

function reserver(local_root, reservations) {

	// Traverse the main line and find the x location for the whole line (the rightmost x necessary)

	let main_line_x = 0;
	let node = local_root;

	while (true) {
		let y = node.depth;
		if (reservations[y] !== undefined && reservations[y] >= main_line_x) {
			main_line_x = reservations[y] + 1;
		}
		if (node.children.length === 0) {
			break;
		}
		node = node.children[0];
	}

	// Set all the nodes in the main line to that x...
	// Make a list of subtrees that need handling...

	node = local_root;
	let subtree_roots = [];

	while (true) {
		reservations[node.depth] = main_line_x;
		node.graphx = main_line_x;
		if (node.children.length === 0) {
			break;
		} else if (node.children.length >= 2) {
			for (let n = node.children.length - 1; n > 0; n--) {
				subtree_roots.push(node.children[n]);
			}
		}

		node = node.children[0];
	}

	subtree_roots.reverse();

	// Handle the subtrees...

	for (let child of subtree_roots) {
		reserver(child, reservations);
	}
}



module.exports = new_tree_drawer;
