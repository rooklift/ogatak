"use strict";

const fs = require("fs");
const path = require("path");

const {ipcRenderer} = require("electron");
const {defaults} = require("./config_io");
const translate = require("./translate");

const multichecks = {
	// Some special submenus are not included here, when their values don't match their labels.
	report_every:			[translate("MENU_SETUP"), translate("MENU_ENGINE_REPORT_RATE")],
	autoanalysis_visits:	[translate("MENU_ANALYSIS"), translate("MENU_AUTOANALYSIS_VISITS")],
	analysis_pv_len:		[translate("MENU_ANALYSIS"), translate("MENU_PV_LENGTH_MAX")],
	wide_root_noise:		[translate("MENU_ANALYSIS"), translate("MENU_WIDE_ROOT_NOISE")],
	ownership_marks:		[translate("MENU_ANALYSIS"), translate("MENU_OWNERSHIP")],
	numbers:				[translate("MENU_DISPLAY"), translate("MENU_NUMBERS")],
	graph_type:				[translate("MENU_DISPLAY"), translate("MENU_GRAPH")],
	board_line_width:		[translate("MENU_SIZES"), translate("MENU_BOARD_LINES")],
	info_font_size:			[translate("MENU_SIZES"), translate("MENU_INFO_FONT")],
	graph_width:			[translate("MENU_SIZES"), translate("MENU_GRAPH_WIDTH")],
	major_graph_linewidth:	[translate("MENU_SIZES"), translate("MENU_GRAPH_MAJOR_LINES")],
	minor_graph_linewidth:	[translate("MENU_SIZES"), translate("MENU_GRAPH_MINOR_LINES")],
	thumbnail_square_size:	[translate("MENU_SIZES"), translate("MENU_THUMBNAIL_SQUARES")],
	tree_spacing:			[translate("MENU_SIZES"), translate("MENU_TREE_SPACING")],
	comment_box_height: 	[translate("MENU_SIZES"), translate("MENU_COMMENT_BOX")],
};

const togglechecks = {
	symmetry_pruning:		[translate("MENU_ANALYSIS"), translate("MENU_SYMMETRY_PRUNING")],
	ownership_per_move:		[translate("MENU_ANALYSIS"), translate("MENU_PER_MOVE")],
	black_pov:				[translate("MENU_DISPLAY"), translate("MENU_BLACK_POV_ALWAYS")],
	candidate_moves:		[translate("MENU_DISPLAY"), translate("MENU_CANDIDATE_MOVES")],
	mouseover_pv:			[translate("MENU_DISPLAY"), translate("MENU_WITH_PV_MOUSEOVER")],
	visit_colours:			[translate("MENU_DISPLAY"), translate("MENU_FADE_BY_VISITS")],
	next_move_markers:		[translate("MENU_DISPLAY"), translate("MENU_NEXT_MOVE_MARKERS")],
	embiggen_small_boards:	[translate("MENU_SIZES"), translate("MENU_EMBIGGEN_SMALL_BOARDS")],
	load_at_end:			[translate("MENU_MISC"), translate("MENU_LOAD_GAMES_AT_FINAL_POSITION")],
	guess_ruleset:			[translate("MENU_MISC"), translate("MENU_GUESS_RULES_FROM_KOMI_ON_LOAD")],
	tygem_3:				[translate("MENU_MISC"), translate("MENU_PREFER_TYGEM_HANDICAP_3_LAYOUT")],
	enable_hw_accel:		[translate("MENU_MISC"), translate("MENU_ENABLE_HARDWARE_ACCELERATION_FOR_GUI")],
	zobrist_checks:			[translate("MENU_DEV"), translate("MENU_ZOBRIST_MISMATCH_CHECKS")],
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

		case "language":

			let s = translate("ALERT_RESTART_REQUIRED", value);
			alert(s);
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
		if (config.visits_threshold === 0) label = translate("MENU_ALL");
		if (config.visits_threshold > 0) label = `N > ${config.visits_threshold * 100}%`;
		ipcRenderer.send("set_checks", [translate("MENU_DISPLAY"), translate("MENU_VISIT_FILTER"), label]);
	},

	fix_tools_menu: function() {

		let mode_strings = {
			"AB": translate("MENU_ADD_BLACK"),
			"AW": translate("MENU_ADD_WHITE"),
			"AE": translate("MENU_ADD_EMPTY"),
			"TR": translate("MENU_TRIANGLE"),
			"SQ": translate("MENU_SQUARE"),
			"CR": translate("MENU_CIRCLE"),
			"MA": translate("MENU_CROSS"),
			"LB:A": translate("MENU_LABELS_ABC"),
			"LB:1": translate("MENU_LABELS_123"), 
		};

		if (!config.mode) {
			ipcRenderer.send("set_checks", [translate("MENU_TOOLS"), translate("MENU_NORMAL")]);
		} else {
			ipcRenderer.send("set_checks", [translate("MENU_TOOLS"), mode_strings[config.mode]]);
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
