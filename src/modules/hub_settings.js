"use strict";

const {ipcRenderer} = require("electron");
const {defaults} = require("./config_io");
const {precompute_ownership_colours} = require("./ownership_colours");

const multichecks = {
	// Some special submenus are not included here, when their values don't match their labels.
	report_every:			["Setup", "Engine report rate"],
	autoanalysis_visits:	["Analysis", "Autoanalysis visits"],
	analysis_pv_len:		["Analysis", "PV length (max)"],
	ownership_marks:		["Analysis", "Ownership"],
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
	comment_box_height: 	["Sizes", "Comment box"],
};

const togglechecks = {
	widerootnoise:			["Analysis", "Wide root noise"],
	symmetry_pruning:		["Analysis", "Symmetry pruning"],
	ownership_per_move:		["Analysis", "...per-move (costly)"],
	candidate_moves:		["Display", "Candidate moves"],
	mouseover_pv:			["Display", "...with PV mouseover"],
	visit_colours:			["Display", "...fade by visits"],
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

	set: function(key, value, debug_missing_handlers = false) {

		config[key] = value;

		// Any followup actions....................................................................

		switch (key) {

		case "engine":
		case "engineconfig":
		case "weights":

			// Some shenanigans to actually live-update the about box, if it's open...

			let possibly_existing_about_box_span_id =
				key === "engine"       ? "about_box_engine"       :
				key === "engineconfig" ? "about_box_engineconfig" :
				key === "weights"      ? "about_box_weights"      :
				null;

			let about_box_span = document.getElementById(possibly_existing_about_box_span_id);

			if (about_box_span) {
				about_box_span.innerHTML = value;
			}

			// Now start the engine, maybe...

			if (config.arbitrary_command) {
				alert("An arbitrary engine command exists in the config, so this setting will not be used.");
			} else if (debug_missing_handlers) {
				// Skip messing with the engine, this flag indicates the call was for debugging reasons.
			} else {
				this.maybe_start_engine();
			}
			break;

		case "info_font_size":

			board_drawer.set_infodiv_font_size(value);
			comment_drawer.set_font_size(value);
			fullbox.set_font_size(value);
			root_editor.set_font_size(value);

			// Changing the infodiv font will affect the space left for the board, thus...

			if (config.auto_square_size) {
				this.autoset_square_size();
			}
			break;

		case "auto_square_size":
		case "maxed":							// This is a rather special setting.

			if (config.auto_square_size) {
				this.autoset_square_size();
			}
			break;

		case "wood_colour":
			precompute_ownership_colours(value);
			tabber.draw_everything(this.node);
			this.draw();
			break;

		case "mode":
		case "square_size":
		case "board_font_size":
		case "board_line_width":
		case "grid_colour":
		case "top_colour_black":
		case "top_colour_white":
		case "off_colour_black":
		case "off_colour_white":
		case "wood_colour":
		case "previous_marker":
		case "candidate_moves":
		case "numbers":
		case "visits_threshold":
		case "mouseover_pv":
		case "next_move_markers":
		case "visit_colours":
		case "black_pov":

			this.draw();
			break;

		case "thumbnail_square_size":

			tabber.draw_everything(this.node);
			break;

		case "graph_type":
		case "minor_graph_linewidth":
		case "major_graph_linewidth":
		case "minor_graph_colour":
		case "major_graph_colour":
		case "major_graph_var_colour":
		case "midline_graph_colour":
		case "graph_width":

			grapher.draw_graph(this.node);
			break;

		case "tree_spacing":
		case "tree_off_colour":
		case "tree_main_colour":
		case "central_node_colour":

			tree_drawer.weak_draw = true;
			break;

		case "comment_box_height":

			tree_drawer.weak_draw = true;			// Because the tree drawer actually controls the height of the comments.
			comment_drawer.draw(this.node);
			break;

		case "analysis_pv_len":
		case "widerootnoise":
		case "symmetry_pruning":
		case "report_every":

			if (this.engine.desired) {
				this.go();
			}
			break;

		case "ownership_marks":
		case "ownership_per_move":

			if (this.engine.desired) {
				this.go();
			}
			this.draw();
			break;

		default:

			if (debug_missing_handlers) {
				console.log(`${key}`);
			}
			break;

		}

		// Fix any multi-check menu items..........................................................

		if (key in multichecks) {
			ipcRenderer.send("set_checks", multichecks[key].concat([value]));
		}

		if (key === "visits_threshold") {
			this.fix_visit_filter_menu();
		}

		if (key === "top_colour_black" || key === "top_colour_white" || key === "off_colour_black" || key === "off_colour_white") {
			this.fix_colours_menu();
		}

		if (key === "mode") {
			this.fix_tools_menu();
		}

		// Fix any toggle menu items...............................................................

		if (key in togglechecks) {
			ipcRenderer.send(value ? "set_check_true" : "set_check_false", togglechecks[key]);
		}

	},

	// --------------------------------------------------------------------------------------------

	fix_colours_menu: function() {
		ipcRenderer.send("fix_colour_checks", {
			top_colour_black: config.top_colour_black,
			top_colour_white: config.top_colour_white,
			off_colour_black: config.off_colour_black,
			off_colour_white: config.off_colour_white,
		});
	},

	fix_visit_filter_menu: function() {
		let label = "?";
		if (config.visits_threshold === 0) label = "All";
		if (config.visits_threshold > 0) label = `N > ${config.visits_threshold * 100}%`;
		ipcRenderer.send("set_checks", ["Display", "Visit filter", label]);
	},

	fix_tools_menu: function() {

		const mode_strings = {
			"AB": "Add Black", "AW": "Add White", "AE": "Add Empty",
			"TR": "Triangle", "SQ": "Square", "CR": "Circle", "MA": "Cross",
			"LB:A": "Labels (ABC)", "LB:1": "Labels (123)", 
		};

		if (!config.mode) {
			ipcRenderer.send("set_checks", ["Tools", "Normal"]);
		} else {
			ipcRenderer.send("set_checks", ["Tools", mode_strings[config.mode]]);
		}
	},

	apply_colour_settings: function(o) {
		for (let key of Object.keys(o)) {
			config[key] = o[key];
		}
		this.draw();								// Currently this is enough.
		this.fix_colours_menu();
	},

	reset: function(key) {
		if (defaults[key] === undefined) {
			throw new Error("reset(): key not in defaults");
		}
		this.set(key, defaults[key]);
		return defaults[key];
	},

	list_keys_without_handlers: function() {		// For debugging.
		for (let key of Object.keys(config)) {
			this.set(key, config[key], true);		// Note this sets the key to its current value, possibly triggering side effects.
		}
	},

};
