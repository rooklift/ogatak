"use strict";

const {ipcRenderer} = require("electron");
const {defaults} = require("./config_io");

const multichecks = {
	// visits_threshold not included here.
	autoanalysis_visits:	["Analysis", "Autoanalysis visits"],
	numbers:				["Display", "Numbers"],
	graph_type:				["Display", "Graph"],
	square_size:			["Sizes", "Board squares"],
	board_font_size:		["Sizes", "Board font"],
	board_line_width:		["Sizes", "Board lines"],
	info_font_size:			["Sizes", "Info font"],
	graph_width:			["Sizes", "Graph width"],
	major_graph_linewidth:	["Sizes", "Graph major lines"],
	minor_graph_linewidth:	["Sizes", "Graph minor lines"],
	thumbnail_square_size:	["Sizes", "Thumbnail squares"],
	tree_spacing:			["Sizes", "Tree spacing"],
	comment_height: 		["Sizes", "Comment box"],
	report_every:			["Misc", "Engine report rate"],
};

const togglechecks = {
	widerootnoise:			["Analysis", "Wide root noise"],
	symmetry_pruning:		["Analysis", "Symmetry pruning"],
	dead_stone_prediction:	["Analysis", "Dead stone prediction"],
	dead_stone_per_move:	["Analysis", "...per move"],
	candidate_moves:		["Display", "Candidate moves"],
	mouseover_pv:			["Display", "...with PV mouseover"],
	visit_colours:			["Display", "...colour by visits"],
	next_move_markers:		["Display", "Next move markers"],
	auto_square_size:		["Sizes", "Auto-resize squares"],
	stderr_to_console:		["Misc", "Log engine stderr to console"],
	load_at_end:			["Misc", "Load games at final position"],
};

// The following lines just ask main process to check the menupath exists,
// so we catch mistakes early in the dev process...

for (let menupath of Object.values(multichecks)) {
	ipcRenderer.send("verify_menupath", menupath);
}

for (let menupath of Object.values(togglechecks)) {
	ipcRenderer.send("verify_menupath", menupath);
}

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

		case "info_font_size":

			this.comment_drawer.fix_font();
			board_drawer.fix_infodiv_font();

			// Changing the infodiv font will affect the space left for the board, thus...

			if (config.auto_square_size) {
				let new_size = this.calculate_square_size();
				if (new_size !== config.square_size) {
					this.set("square_size", new_size);
				}
			}
			break;

		case "square_size":
		case "board_font_size":
		case "board_line_width":
		case "top_colour_black":
		case "top_colour_white":
		case "off_colour_black":
		case "off_colour_white":
		case "wood_colour":
		case "previous_marker":
		case "candidate_moves":
		case "numbers":
		case "visits_threshold":
		case "dead_threshold":
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

		case "comment_height":

			this.tree_drawer.must_draw = true;		// Because the tree drawer actually controls the height of the comments.
			this.comment_drawer.draw(this.node);
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

		// Fix any multi-check menu items..........................................................

		if (key in multichecks) {
			ipcRenderer.send("set_checks", multichecks[key].concat([value]));
		}

		if (key === "visits_threshold") {
			let label = "?";
			if (value === 0) label = "All";
			if (value > 0) label = `N > ${value * 100}%`;
			ipcRenderer.send("set_checks", ["Display", "Visit filter", label]);
		}

		// Fix any toggle menu items...............................................................

		if (key in togglechecks) {
			ipcRenderer.send(value ? "set_check_true" : "set_check_false", togglechecks[key]);
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
