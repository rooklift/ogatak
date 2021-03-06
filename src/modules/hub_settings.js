"use strict";

const fs = require("fs");
const path = require("path");

const {ipcRenderer} = require("electron");
const {defaults} = require("./config_io");

const multichecks = {
	// Some special submenus are not included here, when their values don't match their labels.
	report_every:			["Setup", "Engine report rate"],
	autoanalysis_visits:	["Analysis", "Autoanalysis visits"],
	analysis_pv_len:		["Analysis", "PV length (max)"],
	wide_root_noise:		["Analysis", "Wide root noise"],
	ownership_marks:		["Analysis", "Ownership"],
	numbers:				["Display", "Numbers"],
	graph_type:				["Display", "Graph"],
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
	symmetry_pruning:		["Analysis", "Symmetry pruning"],
	ownership_per_move:		["Analysis", "...per-move (costly)"],
	black_pov:				["Display", "Black POV always"],
	candidate_moves:		["Display", "Candidate moves"],
	mouseover_pv:			["Display", "...with PV mouseover"],
	visit_colours:			["Display", "...fade by visits"],
	next_move_markers:		["Display", "Next move markers"],
	embiggen_small_boards:	["Sizes", "Embiggen small boards"],
	load_at_end:			["Misc", "Load games at final position"],
	guess_ruleset:			["Misc", "Guess rules from komi on load"],
	tygem_3:				["Misc", "Prefer Tygem handicap-3 layout"],
	enable_hw_accel:		["Misc", "Enable hardware acceleration for GUI"],
	zobrist_checks:			["Dev", "Zobrist mismatch checks"],
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

		let old_value = config[key];
		config[key] = value;

		// Any followup actions....................................................................

		switch (key) {

		case "engine":
		case "engineconfig":
		case "weights":

			if (key === "engine" && typeof value === "string") {

				if (value.includes("bs29")) {
					alert("The path specified contains \"bs29\" suggesting this is the slower version of KataGo " +
						"compiled for large board sizes. Consider acquiring the normal version.");
				}

				// Autodetect analysis_example.cfg if the "engineconfig" setting isn't already set...

				if (!config["engineconfig"]) {
					let expected_analysis_cfg = path.join(path.dirname(value), "analysis_example.cfg");
					if (fs.existsSync(expected_analysis_cfg)) {
						config["engineconfig"] = expected_analysis_cfg;
					}
				}
			}

			if (key === "engineconfig" && typeof value === "string") {

				if (["default_gtp.cfg", "contribute_example.cfg", "match_example.cfg"].includes(path.basename(value))) {

					alert("The filename specified appears to be the wrong type of config file. You should use analysis_example.cfg instead.");
					
					config[key] = old_value;		// Refuse to accept this.
					break;
				}
			}

			if (config.arbitrary_command) {
				alert("An arbitrary engine command exists in the config, so this setting will not be used.");
			} else {
				this.start_engine();				// Won't do anything unless all 3 settings are valid.
			}
			break;

		case "info_font_size":

			board_drawer.set_infodiv_font_size(value);
			comment_drawer.set_font_size(value);
			fullbox.set_font_size(value);
			stderrbox.set_font_size(value);
			root_editor.set_font_size(value);

			// Changing the infodiv font will affect the space left for the board, thus...

			this.redraw_if_desired_square_size_mismatch();

			// It can also push the comment box offscreen...

			comment_drawer.textarea.blur();

			break;

		case "wood_colour":
			tabber.draw_everything(this.node);
			break;

		case "mode":
		case "board_font_override":
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

		case "embiggen_small_boards":

			board_drawer.width = null;				// Force it to rebuild.
			this.draw();
			comment_drawer.textarea.blur();			// In case it's been pushed offscreen (the rebuild can slightly change the board's width).
			break;

		case "thumbnail_square_size":

			tabber.draw_everything(this.node);
			comment_drawer.textarea.blur();			// In case it's been pushed offscreen.
			break;

		case "graph_type":
		case "minor_graph_linewidth":
		case "major_graph_linewidth":
		case "minor_graph_colour":
		case "major_graph_colour":
		case "major_graph_var_colour":
		case "midline_graph_colour":

			grapher.draw_graph(this.node);
			break;

		case "graph_width":

			grapher.draw_graph(this.node);
			comment_drawer.textarea.blur();			// In case it's been pushed offscreen.
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
		case "wide_root_noise":
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

		case "enable_hw_accel":

			let msg = "This will not take effect until you restart Ogatak.";
			if (value) msg += " Note that on some systems this setting may degrade performance, by making KataGo and Ogatak fight over the GPU.";
			alert(msg);
			break;

		}

		// Various fixes to menu items and suchlike................................................

		if (multichecks.hasOwnProperty(key)) {
			ipcRenderer.send("set_checks", multichecks[key].concat([value]));
		}

		if (togglechecks.hasOwnProperty(key)) {
			ipcRenderer.send(value ? "set_check_true" : "set_check_false", togglechecks[key]);
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

		if (key === "engine" || key === "engineconfig" || key === "weights") {
			this.fix_about_box();
		}

	},

	// --------------------------------------------------------------------------------------------

	fix_about_box: function() {
		let element;
		element = document.getElementById("about_box_engine");
		if (element) element.innerHTML = config.engine || "(unset)";
		element = document.getElementById("about_box_engineconfig");
		if (element) element.innerHTML = config.engineconfig || "(unset)";
		element = document.getElementById("about_box_weights");
		if (element) element.innerHTML = config.weights || "(unset)";
	},

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

	differences: function() {
		for (let key of Object.keys(defaults)) {
			if (defaults[key] !== config[key]) {
				console.log(key, JSON.stringify(defaults[key]), JSON.stringify(config[key]));
			}
		}
	},

};
