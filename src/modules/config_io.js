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

exports.defaults = {		// Nothing in this should be undefined.

	"engine": "",
	"engineconfig": "",
	"weights": "",

	"width": 900,
	"height": 740,

	"square_size": 34,
	"board_font_size": 14,

	"best_colour_black": "#99dd55ff",
	"best_colour_white": "#99dd55ff",
	"wood_colour": "#d2b074ff",

	"previous_marker": "#888888ff",		// or maybe: "#ff0000aa" or "#0099ffaa"

	"minor_graph_colour": "#444444ff",
	"major_graph_colour": "#4ba28bff",

	"graph_position_colour": "#4ba28bff",
	"graph_position_var_colour": "#aaaa00ff",

	"minor_graph_linewidth": 1,
	"major_graph_linewidth": 2,

	"rules": "chinese",

	"next_size": 19,
	"next_komi": 7.5,
	"next_handicap": 0,

	"graph_draw_delay": 200,

	"candidate_moves": true,
	"numbers": "lcb",
	"visits_threshold": 0.02,
	"next_move_markers": true,
	"graph_type": "score",

	"widerootnoise": true,
	"autoanalysis_visits": 500,
};

// ---------------------------------------------------------------------------------------------------------------------------

let errortext = "";

exports.error = () => {
	return errortext;
};

// ---------------------------------------------------------------------------------------------------------------------------

exports.load = () => {

	// SEMI-DISABLED FOR 0.24 TEST BRANCH

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

exports.save = () => {					// DISABLED FOR 0.24 TEST BRANCH
	return;
};

// ---------------------------------------------------------------------------------------------------------------------------

exports.create_if_needed = () => {		// DISABLED FOR 0.24 TEST BRANCH
	return;
};
