"use strict";

const {node_id_from_search_id, get_href_query_val} = require("./utils");

const zoomfactor = parseFloat(get_href_query_val("zoomfactor"));


(function active_tab_draw_spinner() {
	tabber.draw_active_tab(hub.node);
	setTimeout(active_tab_draw_spinner, 200);
})();

(function graph_draw_spinner() {
	grapher.draw_graph(hub.node, true);			// Always does a full draw, seems fast enough.
	setTimeout(graph_draw_spinner, 200);
})();

(function tree_draw_spinner() {
	tree_drawer.draw_tree(hub.node);			// Can skip the draw if not needed.
	setTimeout(tree_draw_spinner, 17);
})();

(function up_down_spinner() {

	// The point of this is to avoid a situation where a draw is slow, while up/down events are piling up, leading to a bunch of draws
	// being required all at once. Instead of that, up/down events just adjust a variable, and this spinner does the actual draws.

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

	setTimeout(up_down_spinner, 10);
})();

(function window_resize_spinner() {

	// Poll the window size; adjust our settings if needed. Does nothing if main.js has told us we are maxed (by setting config.maxed).
	// There is a race condition here -- the spinner might run after the maximize but before hub has told us about it -- but meh.

	if (!config.maxed) {

		let width = Math.floor(window.innerWidth * zoomfactor);
		let height = Math.floor(window.innerHeight * zoomfactor);

		if (config.width !== width || config.height !== height) {

			config.width = width;
			config.height = height;

			if (config.auto_square_size) {
				hub.autoset_square_size();
			}
		}
	}

	setTimeout(window_resize_spinner, 125);
})();

(function bad_ownership_mark_spinner() {

	// Our board drawer can draw ownership marks based on ancestor nodes, on the assumption that real
	// data for the current node will soon arrive. But if the search ends and it never does we need
	// to clear those tentative ownership marks.

	if (board_drawer.has_ownership_marks) {
		if (!hub.node.has_valid_analysis() || !hub.node.analysis.ownership) {
			if (!hub.engine.desired || node_id_from_search_id(hub.engine.desired.id) !== hub.node.id) {
				hub.draw();
			}
		}
	}

	setTimeout(bad_ownership_mark_spinner, 190);
})();

