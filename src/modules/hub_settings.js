"use strict";

const {ipcRenderer} = require("electron");
const {defaults} = require("./config_io");

module.exports = {

	set: function(key, value) {

		config[key] = value;

		// Any followup actions....................................................................

		switch (key) {

		case "engine":
		case "engineconfig":
		case "weights":

			if (config.arbitrary_command) {
				alert("An arbitrary engine command exists in the config, so this setting will not be used.");
			} else {
				this.maybe_start_engine();
			}
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
				}
			}
			this.tree_drawer.must_draw = true;
			break;

		case "board_font_size":
		case "top_colour_black":
		case "top_colour_white":
		case "off_colour_black":
		case "off_colour_white":
		case "wood_colour":
		case "previous_marker":
		case "next_marker_linewidth":
		case "candidate_moves":
		case "numbers":
		case "visits_threshold":
		case "mouseover_pv":
		case "next_move_markers":
		case "visit_colours":

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
		case "tree_off_colour":
		case "tree_main_colour":
		case "central_node_colour":

			this.tree_drawer.must_draw = true;
			break;

		case "widerootnoise":
		case "symmetry_pruning":
		case "report_every":

			if (this.engine.desired) {
				this.go();
			}
			break;

		case "dead_stone_prediction":
		case "dead_stone_per_move":

			if (this.engine.desired) {
				this.go();
			}
			this.draw();
			break;

		}

		// Separarely, fix any relevant menu items.................................................

		switch (key) {

		case "square_size":
			ipcRenderer.send("set_checks", ["Sizes", "Board squares", value]);
			break;
		case "board_font_size":
			ipcRenderer.send("set_checks", ["Sizes", "Board font", value]);
			break;
		case "board_line_width":
			ipcRenderer.send("set_checks", ["Sizes", "Board lines", value]);
			break;
		case "info_font_size":
			ipcRenderer.send("set_checks", ["Sizes", "Info font", value]);
			break;
		case "graph_width":
			ipcRenderer.send("set_checks", ["Sizes", "Graph width", value]);
			break;
		case "major_graph_linewidth":
			ipcRenderer.send("set_checks", ["Sizes", "Graph major lines", value]);
			break;
		case "minor_graph_linewidth":
			ipcRenderer.send("set_checks", ["Sizes", "Graph minor lines", value]);
			break;
		case "thumbnail_square_size":
			ipcRenderer.send("set_checks", ["Sizes", "Thumbnail squares", value]);
			break;
		case "tree_spacing":
			ipcRenderer.send("set_checks", ["Sizes", "Tree spacing", value]);
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

	reset: function(key) {
		if (defaults[key] === undefined) {
			throw "Key not in defaults";
		}
		this.set(key, defaults[key]);
	},

};
