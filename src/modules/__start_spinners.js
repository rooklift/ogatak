"use strict";

// A "spinner" is just what I call a function that calls itself via setTimeout. They "spin".
// I'm sure there's some technical term somewhere. The rather arbitrary timings are just to
// make accidental sync-ups less common, which could conceivably cause lag when they occur.

const {node_id_from_search_id} = require("./utils");

// ------------------------------------------------------------------------------------------------

(function active_tab_draw_spinner() {
	tabber.draw_active_tab(hub.node);
	setTimeout(active_tab_draw_spinner, 211);
})();

// ------------------------------------------------------------------------------------------------

(function graph_draw_spinner() {
	grapher.draw_graph(hub.node, true);			// Always does a full draw, seems fast enough.
	setTimeout(graph_draw_spinner, 199);
})();

// ------------------------------------------------------------------------------------------------

(function tree_draw_spinner() {
	tree_drawer.draw_tree(hub.node);			// Can skip the draw if not needed.
	setTimeout(tree_draw_spinner, 17);
})();

// ------------------------------------------------------------------------------------------------
// The point of this is to avoid a situation where a draw is slow, while up/down events are piling
// up, leading to a bunch of draws being required all at once. Instead of that, up/down events just
// adjust a variable, and this spinner does the actual draws.

(function up_down_spinner() {

	let n = hub.pending_up_down;
	hub.pending_up_down = 0;

	if (n === 1) {
		hub.next();
	} else if (n > 1) {
		hub.forward(n);
	} else if (n === -1) {
		hub.prev();
	} else if (n < -1) {
		hub.backward(n * -1);
	}

	setTimeout(up_down_spinner, 11);
})();

// ------------------------------------------------------------------------------------------------
// TODO - 

(function window_resize_spinner() {
	hub.autoset_square_size();
	setTimeout(window_resize_spinner, 127);
})();

// ------------------------------------------------------------------------------------------------
// Our board drawer can draw ownership marks based on ancestor nodes, on the assumption that real
// data for the current node will soon arrive. But if the search ends and it never does we need
// to clear those tentative ownership marks.

(function bad_ownership_spinner() {
	if (board_drawer.has_drawn_ownership) {
		if (!hub.node.has_valid_analysis() || !hub.node.analysis.ownership) {
			if (!hub.engine.desired || node_id_from_search_id(hub.engine.desired.id) !== hub.node.id) {
				hub.draw();
				console.log("bad_ownership_spinner() fired!");
			}
		}
	}

	setTimeout(bad_ownership_spinner, 191);
})();

// ------------------------------------------------------------------------------------------------
// Mousemove events (with button down) on the grapher have been setup to store a pending y value
// there, so that we can actually react at a slower pace...

(function graph_mousemove_spinner() {
	if (typeof grapher.pending_mousemove_y === "number") {
		let node = grapher.node_from_click_y(hub.node, grapher.pending_mousemove_y);
		if (node) {
			hub.set_node(node, {bless: false});
		}
	}
	grapher.pending_mousemove_y = null;
	setTimeout(graph_mousemove_spinner, 41);
})();
