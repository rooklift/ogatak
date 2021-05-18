"use strict";

function new_tree_drawer(canvas) {
	let drawer = Object.create(tree_drawer_prototype);
	drawer.canvas = canvas;
	drawer.clickers = [];
	drawer.last_draw_cost = 0;
	drawer.central_node = null;
	return drawer;
}

let tree_drawer_prototype = {

	draw_tree: function(central_node) {

		this.canvas.width = Math.max(0, window.innerWidth - this.canvas.getBoundingClientRect().left);
		this.canvas.height = Math.max(0, window.innerHeight - this.canvas.getBoundingClientRect().top);

		this.clickers = [];
		this.central_node = central_node;					// Don't make this null, ever, it will provoke the spinner.

		if (this.canvas.width <= config.tree_spacing || this.canvas.height <= config.tree_spacing) {
			return;
		}

		if (!central_node.parent && central_node.children.length === 0) {
			return;
		}

		let start_time = performance.now();

		let root = central_node.get_root();

		reserver(root, []);									// Makes all nodes have .logicalx

		let provisional_central_node_gx = this.canvas.width / 2;
		let provisional_central_node_gy = this.canvas.height / 2;
		let provisional_root_gx = provisional_central_node_gx + ((root.logicalx - central_node.logicalx) * config.tree_spacing);
		let provisional_root_gy = provisional_central_node_gy + ((root.depth - central_node.depth) * config.tree_spacing);

		let final_adjust_x = 0;
		let final_adjust_y = 0;
		if (provisional_root_gx > config.tree_spacing / 2) final_adjust_x = config.tree_spacing - provisional_root_gx;
		// if (provisional_root_gy > config.tree_spacing / 2) final_adjust_y = config.tree_spacing - provisional_root_gy;

		this.__draw(										// Makes all nodes have .gx and .gy
			root,
			central_node,
			provisional_central_node_gx + final_adjust_x,
			provisional_central_node_gy + final_adjust_y
		);

		let ctx = this.canvas.getContext("2d");
		ctx.fillStyle = config.central_node_colour;
		ctx.fillRect(central_node.gx - config.tree_spacing / 3, central_node.gy - config.tree_spacing / 3, config.tree_spacing * 2 / 3, config.tree_spacing * 2 / 3);

		this.last_draw_cost = performance.now() - start_time;

	},

	__draw: function(local_root, central_node, central_node_gx, central_node_gy) {

		let ctx = this.canvas.getContext("2d");

		let node = local_root;

		while (true) {

			node.gx = Math.floor(central_node_gx + ((node.logicalx - central_node.logicalx) * config.tree_spacing));
			node.gy = Math.floor(central_node_gy + ((node.depth - central_node.depth) * config.tree_spacing));

			let gsib = node.greater_sibling();
			let need_to_draw = false;

			// There are two main reasons to draw the node:
			//		- node itself is onscreen;
			//		- node's greater sibling is onscreen, or offscreen left while node is offscreen right, so draw for the sake of the line;

			if (node.gx > 0 && node.gy > 0 && node.gy < this.canvas.height) {
				if (node.gx < this.canvas.width) {
					need_to_draw = true;
				} else if (gsib && gsib.gx < this.canvas.width) {		// Test relies on the fact that gsib has already been dealt with so has .gx
					need_to_draw = true;
				}
			}

			// But I guess we also draw if the node's parent is onscreen, again for the sake of the line.

			if (!need_to_draw) {
				if (node.parent && node.parent.gx > 0 && node.parent.gx < this.canvas.width && node.parent.gy > 0 && node.parent.gy < this.canvas.height) {
					need_to_draw = true;
				}
			}

			if (need_to_draw) {

				this.clickers.push({x: node.gx, y: node.gy, node: node});

				if (node.parent && node.parent.children.length > 1) {
					ctx.beginPath();
					ctx.arc(node.gx, node.gy, (config.tree_spacing / 4) + 1, 0, 2 * Math.PI);
					ctx.fillStyle = config.tree_node_colour;
					ctx.fill();
				} else {
					ctx.beginPath();
					ctx.arc(node.gx, node.gy, (config.tree_spacing / 4), 0, 2 * Math.PI);
					ctx.strokeStyle = config.tree_node_colour;
					ctx.lineWidth = 2;
					ctx.stroke();
				}

				if (node.parent) {
					ctx.strokeStyle = config.tree_node_colour;
					ctx.lineWidth = 2;
					if (gsib) {
						ctx.beginPath();
						ctx.moveTo(node.gx - (config.tree_spacing / 4), node.gy);
						ctx.lineTo(gsib.gx + (config.tree_spacing / 4), gsib.gy);
						ctx.stroke();
					} else {
						ctx.beginPath();
						ctx.moveTo(node.gx, node.gy - (config.tree_spacing / 4));
						ctx.lineTo(node.parent.gx, node.parent.gy + (config.tree_spacing / 4));
						ctx.stroke();
					}
				}
			}

			if (node.children.length > 1) {
				for (let child of node.children) {
					this.__draw(child, central_node, central_node_gx, central_node_gy);
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

	node_from_click: function(hub_node, event) {

		if (!event) {
			return null;
		}

		let mousex = event.offsetX;
		let mousey = event.offsetY;
		if (typeof mousex !== "number" || typeof mousey !== "number") {
			return null;
		}

		for (let clicker of this.clickers) {
			if (Math.abs(clicker.x - mousex) < config.tree_spacing / 2) {
				if (Math.abs(clicker.y - mousey) < config.tree_spacing / 2) {
					if (clicker.node.destroyed || clicker.node.get_root() !== hub_node.get_root()) {		// Some sanity checks
						return null;
					} else {
						return clicker.node;
					}
				}
			}
		}

		return null;
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
	//
	// Make a list of subtrees that need handling... note that
	// the correct order for handling subtrees is like so, for
	// this example with three subtrees. 1 before 2 before 3.
	//
	//		x
	//		x-----2--3
	//		x     x  x
	//		x--1  x  x
	//		x  x  x
	//		x

	node = local_root;
	let subtree_roots = [];

	while (true) {
		reservations[node.depth] = main_line_x;
		node.logicalx = main_line_x;
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
