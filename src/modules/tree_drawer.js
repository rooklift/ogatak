"use strict";

function new_tree_drawer(canvas) {
	let drawer = Object.create(tree_drawer_prototype);
	drawer.canvas = canvas;
	drawer.clickers = [];
	drawer.last_draw_cost = 0;
	return drawer;
}

let tree_drawer_prototype = {

	draw_tree: function(central_node) {

		this.canvas.width = Math.max(0, window.innerWidth - this.canvas.getBoundingClientRect().left);
		this.canvas.height = Math.max(0, window.innerHeight - this.canvas.getBoundingClientRect().top);

		this.clickers = [];

		if (this.canvas.width < 12) {
			return;
		}

		let start_time = performance.now();

		let root = central_node.get_root();

		reserver(root, []);									// Makes all nodes have .logicalx

		let provisional_central_node_gx = this.canvas.width / 2;
		let provisional_central_node_gy = this.canvas.height / 2;
		let provisional_root_gx = provisional_central_node_gx + ((root.logicalx - central_node.logicalx) * 24);
		let provisional_root_gy = provisional_central_node_gy + ((root.depth - central_node.depth) * 24);

		let final_adjust_x = 0;
		let final_adjust_y = 0;
		if (provisional_root_gx > 24) final_adjust_x = 24 - provisional_root_gx;
		// if (provisional_root_gy > 24) final_adjust_y = 24 - provisional_root_gy;

		this.__draw(										// Makes all nodes have .gx and .gy
			root,
			central_node,
			provisional_central_node_gx + final_adjust_x,
			provisional_central_node_gy + final_adjust_y
		);

		let ctx = this.canvas.getContext("2d");
		ctx.fillStyle = "#d2b074ff";
		ctx.fillRect(central_node.gx - 8, central_node.gy - 8, 16, 16);
		ctx.fill();

		this.last_draw_cost = performance.now() - start_time;

	},

	__draw: function(local_root, central_node, central_node_gx, central_node_gy) {

		let ctx = this.canvas.getContext("2d");
		ctx.fillStyle = "#aaaaaaff";
		ctx.strokeStyle = "#aaaaaaff";
		ctx.lineWidth = 1;

		let node = local_root;

		while (true) {

			node.gx = 0.5 + Math.floor(central_node_gx + ((node.logicalx - central_node.logicalx) * 24));
			node.gy = 0.5 + Math.floor(central_node_gy + ((node.depth - central_node.depth) * 24));

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

				ctx.beginPath();
				ctx.arc(node.gx, node.gy, 6, 0, 2 * Math.PI);

				if (node.parent && node.parent.children.length > 1) {
					ctx.fill();
				} else {
					ctx.stroke();
				}

				if (node.parent) {
					if (gsib) {
						ctx.beginPath();
						ctx.moveTo(node.gx - 6, node.gy);
						ctx.lineTo(gsib.gx + 6, gsib.gy);
						ctx.stroke();
					} else {
						ctx.beginPath();
						ctx.moveTo(node.gx, node.gy - 6);
						ctx.lineTo(node.parent.gx, node.parent.gy + 6);
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
			if (Math.abs(clicker.x - mousex) < 12) {
				if (Math.abs(clicker.y - mousey) < 12) {
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
	// Make a list of subtrees that need handling...

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
