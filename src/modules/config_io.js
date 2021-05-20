"use strict";

// Remember this will run twice in 2 different processes, so don't autosave etc.

const electron = require("electron");
const fs = require("fs");
const path = require("path");
const querystring = require("querystring");

exports.filename = "config.json";

// To avoid using "remote", we rely on the main process passing userData location in the query...

exports.filepath = electron.app ?
		path.join(electron.app.getPath("userData"), exports.filename) :									// in Main process
		path.join(querystring.parse(global.location.search)["?user_data_path"], exports.filename);		// in Renderer process

// ---------------------------------------------------------------------------------------------------------------------------

exports.config = {};

exports.defaults_classified = {

	// The various classifications get used by the hub to decide what action to take if one of these is changed.
	// Note that the actual defaults object (created below) is a flattened version of this without classifications.

	// It is OK for something to be in multiple classications.

	engine_starters: {
		"engine": "",
		"engineconfig": "",
		"weights": "",
	},

	board_rebuilders: {
		"board_line_width": 1,
		"info_font_size": 16,
		"square_size": 34,
	},

	tab_rebuilders: {
		"thumbnail_square_size": 4,
	},

	board_redrawers: {
		"board_font_size": 14,
		"best_colour_black": "#99dd55ff",
		"best_colour_white": "#99dd55ff",
		"wood_colour": "#d2b074ff",
		"previous_marker": "#888888ff",
		"candidate_moves": true,
		"numbers": "lcb",
		"visits_threshold": 0.02,
		"mouseover_pv": true,
		"next_move_markers": true,
		"circle_best": true,
		"dead_stone_prediction": true,			// Duplicate
	},

	graph_redrawers: {
		"graph_type": "winrate",
		"minor_graph_linewidth": 1,
		"major_graph_linewidth": 2,
		"minor_graph_colour": "#444444ff",
		"major_graph_colour": "#4ba28bff",
		"major_graph_var_colour": "#4b8ba2ff",
		"midline_graph_colour": "#222222ff",
		"graph_width": 224,
	},

	tree_redrawers: {
		"tree_spacing": 24,
		"tree_node_colour": "#909090ff",
		"central_node_colour": "#d2b074ff",
	},

	search_changers: {
		"widerootnoise": true,
		"dead_stone_prediction": true,			// Duplicate
	},

	no_immediate_effect: {
		"width": 1200,
		"height": 740,
		"stderr_to_console": true,
		"load_at_end": true,
		"tree_draw_delay": 17,					// Note that the tree draw will be skipped if not needed.
		"graph_draw_delay": 200,				// The graph draw, however, is never skipped.
		"autoanalysis_visits": 500,
		"default_rules": "Chinese",				// Used for game on startup, as well as when rules are "Unknown".
		"default_komi": 7.5,					// Used for game on startup, but otherwise unknown komi is inferred as zero.
	},
};

exports.defaults = {};

for (let cl of Object.keys(exports.defaults_classified)) {
	for (let key of Object.keys(exports.defaults_classified[cl])) {
		exports.defaults[key] = exports.defaults_classified[cl][key];
	}
}

exports.colour_keys = Object.keys(exports.defaults).filter(key => typeof exports.defaults[key] === "string" && exports.defaults[key][0] === "#");

// ---------------------------------------------------------------------------------------------------------------------------

let errortext = "";

exports.error = () => {
	return errortext;
};

// ---------------------------------------------------------------------------------------------------------------------------

exports.load = () => {

	try {
		if (fs.existsSync(exports.filepath)) {
			Object.assign(exports.config, JSON.parse(fs.readFileSync(exports.filepath, "utf8")));
		}
		errortext = "";
	} catch (err) {
		console.log(err.toString());
		errortext = err.toString();
	}

	// Copy default values for any missing keys into the config...
	// We use a copy so that any objects that are assigned are not the default objects.

	let defaults_copy = JSON.parse(JSON.stringify(exports.defaults));

	for (let key of Object.keys(defaults_copy)) {
		if (exports.config.hasOwnProperty(key) === false) {
			exports.config[key] = defaults_copy[key];
		}
	}
};

// ---------------------------------------------------------------------------------------------------------------------------

exports.save = () => {

	// Don't save if the load failed. Let the user fix their
	// broken config file, don't overwrite it with a fresh one.

	if (errortext) {
		return;
	}

	// Make a copy of the defaults. Doing it this way seems to
	// ensure the final JSON string has the same ordering...

	let out = JSON.parse(JSON.stringify(exports.defaults));

	// Adjust that copy, but only for keys present in both.

	for (let key of Object.keys(exports.config)) {
		if (out.hasOwnProperty(key)) {
			out[key] = exports.config[key];
		}
	}

	try {
		fs.writeFileSync(exports.filepath, JSON.stringify(out, null, "\t"));
	} catch (err) {
		console.log(err.toString());
	}
};

// ---------------------------------------------------------------------------------------------------------------------------

exports.create_if_needed = () => {

	// Note that this must be called fairly late, when userData directory exists.

	if (fs.existsSync(exports.filepath)) {
		return;
	}

	exports.save();
};
