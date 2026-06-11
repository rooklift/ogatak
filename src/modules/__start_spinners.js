"use strict";

// A "spinner" is just what I call a function that calls itself via setTimeout. They "spin".
// I'm sure there's some technical term somewhere. The rather arbitrary timings are just to
// make accidental sync-ups less common, which could conceivably cause lag when they occur.

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

(function window_resize_spinner() {

	// There is likely a race here, as we might notice the window has changed size before the hub
	// has received a notification from main.js to change the value of "maxed" ... meh.

	if (!config.maxed) {
		if (config.width !== window.innerWidth || config.height !== window.innerHeight) {
			config.width = window.innerWidth;
			config.height = window.innerHeight;
		}
	}

	hub.redraw_if_desired_square_size_mismatch();

	setTimeout(window_resize_spinner, 127);

})();

// ------------------------------------------------------------------------------------------------
// Our board drawer can draw ownership marks based on ancestor nodes, on the assumption that real
// data for the current node will soon arrive. But if the search ends and it never does we need
// to clear those tentative ownership marks.

(function bad_ownership_spinner() {
	if (board_drawer.has_drawn_ownership) {
		if (!hub.node.has_valid_analysis() || !hub.node.analysis.ownership) {
			if (!hub.engine.desired) {
				hub.draw();
				console.log("bad_ownership_spinner() fired!");
			}
		}
	}

	setTimeout(bad_ownership_spinner, 191);
})();

// ------------------------------------------------------------------------------------------------
// When config.no_ponder_no_candidates is true, we don't want to display candidate moves when the
// engine is not running. However, calling halt() does not automatically draw, therefore the
// candidate moves can be left visible in some cases...

(function no_ponder_no_candidates_spinner() {
	if (board_drawer.has_drawn_candidates) {
		if (config.no_ponder_no_candidates && !hub.engine.desired) {
			hub.draw();
			console.log("no_ponder_no_candidates_spinner() fired!");
		}
	}

	setTimeout(no_ponder_no_candidates_spinner, 193);
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
	setTimeout(graph_mousemove_spinner, config.mousemove_delay);
})();

// ------------------------------------------------------------------------------------------------
// Likewise, mousemove events while dragging a resize handle just store a pending value, and this
// spinner does the actual (more expensive) resizes. Note that small values snap to 0, which is the
// "hidden" state for both the graph and the comment box. The hardcoded 8s are the handle sizes in
// the CSS.

(function handle_drag_spinner() {

	if (typeof grapher.pending_handle_drag_x === "number") {
		let left = grapher.canvas.getBoundingClientRect().left;
		let width = Math.round(grapher.pending_handle_drag_x - left);
		let max_width = Math.round(window.innerWidth - left - 8);			// So the handle itself stays onscreen.
		if (width > max_width) width = max_width;
		if (width < 40) width = 0;			// Below 40, the grapher is too_small_to_draw() anyway (24 + its two 8px x offsets).
		hub.set("graph_width", width);
		grapher.pending_handle_drag_x = null;
	}

	if (typeof comment_drawer.pending_handle_drag_y === "number") {
		let height = Math.round(window.innerHeight - comment_drawer.pending_handle_drag_y - 4);		// 4 so the handle centre follows the mouse.
		let max_height = Math.round(window.innerHeight - tree_drawer.canvas.getBoundingClientRect().top - 8);
		if (height > max_height) height = max_height;
		if (height < 40) height = 0;		// 40 is enough for one line at default font size, without a scroll bar.
		hub.set("comment_box_height", height);
		comment_drawer.pending_handle_drag_y = null;
	}

	setTimeout(handle_drag_spinner, config.mousemove_delay);
})();

// ------------------------------------------------------------------------------------------------
// If the window shrinks, the graph handle can be pushed offscreen right, where it can never be
// grabbed again, so reduce the graph width as needed to keep it onscreen. We take no action during
// a drag, which has its own clamp in any case.

(function graph_handle_rescue_spinner() {

	if (!grapher.handle_dragging && config.graph_width > 0) {		// The > 0 check matters: if even width 0 doesn't help, we must not spam hub.set().
		let overshoot = Math.ceil(document.getElementById("graphhandle").getBoundingClientRect().right - window.innerWidth);
		if (overshoot > 0) {
			let width = config.graph_width - overshoot;
			if (width < 40) width = 0;
			hub.set("graph_width", width);
		}
	}

	setTimeout(graph_handle_rescue_spinner, 179);
})();

// ------------------------------------------------------------------------------------------------
// In the event that the engine just quits / crashes it will generate an "exit" event which will
// cause hub.engine to enter its terminal state, but we need to do a draw to display the fact...

(function engine_failure_spinner() {
	if (board_drawer.infodiv_displaying_stats) {
		if (!hub.engine.exe || hub.engine.has_quit) {
			hub.draw();
			console.log("engine_failure_spinner() fired!");
		}
	}
	setTimeout(engine_failure_spinner, 1234);
})();

// ------------------------------------------------------------------------------------------------

hub.autoscroller();
