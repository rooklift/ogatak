"use strict";

const {node_id_from_search_id, get_href_query_val} = require("./utils");

const zoomfactor = parseFloat(get_href_query_val("zoomfactor"));


(function active_tab_draw_spinner() {
	tabber.draw_active_tab(hub.node);
	setTimeout(active_tab_draw_spinner, Math.max(50, config.graph_draw_delay));			// Enforce minimum of 50
})();

(function graph_draw_spinner() {
	grapher.draw_graph(hub.node, true);			// Always does a full draw, seems fast enough.
	setTimeout(graph_draw_spinner, Math.max(50, config.graph_draw_delay));				// Enforce minimum of 50
})();

(function tree_draw_spinner() {
	tree_drawer.draw_tree(hub.node);			// Can skip the draw if not needed.
	setTimeout(tree_draw_spinner, Math.max(17, config.tree_draw_delay));				// Enforce minimum of 17
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

	setTimeout(up_down_spinner, config.input_delay);			// This can be a very low number, even 0 might be OK?
})();

(function window_resize_spinner() {

	let width = Math.floor(window.innerWidth * zoomfactor);
	let height = Math.floor(window.innerHeight * zoomfactor);

	if (config.width !== width || config.height !== height) {

		config.width = width;
		config.height = height;

		if (config.auto_square_size) {
			hub.autoset_square_size();
		}
	}

	setTimeout(window_resize_spinner, 125);
})();

(function bad_death_mark_spinner() {

	// Super-lame hack to deal with the situation where death marks were carried over from a previous search but then
	// the new search was terminated instantly (or never started) and those stale death marks need to be removed now
	// (this is needed because nothing else is going to cause a draw to happen).

	if (board_drawer.has_death_marks) {
		if (!hub.node.has_valid_analysis() || !hub.node.analysis.ownership) {
			if (!hub.engine.desired || node_id_from_search_id(hub.engine.desired.id) !== hub.node.id) {
				hub.draw();
			}
		}
	}

	setTimeout(bad_death_mark_spinner, 190);
})();

