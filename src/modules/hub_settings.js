"use strict";

const {ipcRenderer} = require("electron");

module.exports = {

	set: function(key, value) {

		config[key] = value;

		switch (key) {

		case "engine":
		case "engineconfig":
		case "weights":

			this.maybe_start_engine();
			break;

		case "board_line_width":

			this.maindrawer.rebuild(this.node.get_board().width, this.node.get_board().height);
			this.draw();
			break;

		case "square_size":

			this.maindrawer.rebuild(this.node.get_board().width, this.node.get_board().height);
			this.draw();
			this.tree_drawer.must_draw = true;
			break;

		case "info_font_size":

			this.maindrawer.fix_infodiv();
			if (config.auto_square_size) {
				let new_size = this.calculate_square_size();
				if (new_size !== config.square_size) {
					this.set("square_size", new_size);
					ipcRenderer.send("set_checks", ["Sizes", "Board squares", new_size.toString()]);
				}
			}
			this.tree_drawer.must_draw = true;
			break;

		case "board_font_size":
		case "best_colour_black":
		case "best_colour_white":
		case "wood_colour":
		case "previous_marker":
		case "candidate_moves":
		case "numbers":
		case "visits_threshold":
		case "mouseover_pv":
		case "next_move_markers":
		case "circle_best":

			this.draw();
			break;

		case "thumbnail_square_size":

			this.tabber.draw_tabs(this.node);
			break;

		case "graph_type":
		case "minor_graph_linewidth":
		case "major_graph_linewidth":
		case "minor_graph_colour":
		case "major_graph_colour":
		case "major_graph_var_colour":
		case "midline_graph_colour":
		case "graph_width":

			this.grapher.draw_graph(this.node);
			break;

		case "tree_spacing":
		case "tree_node_colour":
		case "central_node_colour":

			this.tree_drawer.must_draw = true;
			break;

		case "widerootnoise":

			if (this.engine.desired) {
				this.go();
			}
			break;

		case "dead_stone_prediction":

			if (this.engine.desired) {
				this.go();
			}
			this.draw();
			break;

		}

	},

	// --------------------------------------------------------------------------------------------

	apply_colour_settings: function(o) {
		for (let key of Object.keys(o)) {
			config[key] = o[key];
		}
		this.draw();						// Currently this is enough.
	},

};
