"use strict";

// Remember this will run twice in 2 different processes, so don't autosave etc.

const electron = require("electron");
const fs = require("fs");
const path = require("path");

const {fix_html_colour} = require("./html_colours");
const translations = require("./translations");
const {get_href_query_val} = require("./utils");
const colour_choices = require("./colour_choices");

exports.filename = "config.json";

// ---------------------------------------------------------------------------------------------------------------------------

let in_main_process = electron.app ? true : false;

if (!in_main_process && !global.user_data_path) {
	throw new Error("config_io: global.user_data_path not set!");
}

exports.filepath = in_main_process ?
		path.join(electron.app.getPath("userData"), exports.filename) :
		path.join(global.user_data_path, exports.filename);

// ---------------------------------------------------------------------------------------------------------------------------

global.config = {};

exports.defaults = {

	// --------------------------------------------------------------------------------------
	// REMEMBER, WHEN ADDING THINGS, ALSO ADD TO hub_settings.js
	// Also remember that none of these should be undefined (won't work with JSON.stringify).
	// --------------------------------------------------------------------------------------

	"language": "English",

	"engine": "",
	"engineconfig": "",
	"weights": "",

	"editing": "",								// Reset at launch.

	"board_line_width": 1,
	"grid_colour": "#000000ff",

	"embiggen_small_boards": true,

	"info_font_size": 16,
	"board_font_override": null,

	"top_colour_black": colour_choices.blue,
	"top_colour_white": colour_choices.blue,
	"off_colour_black": colour_choices.green,
	"off_colour_white": colour_choices.green,
	"wood_colour": "#d0ad75ff",					// Average of our board image, as claimed by matkl.github.io/average-color
	"previous_marker": "#ff6666ff",
	"candidate_moves": true,
	"no_ponder_no_candidates": false,
	"numbers": "Winrate + Visits",				// Lame stringly typed
	"visits_threshold": 0.02,
	"mouseover_pv": true,
	"mouseover_delay": 0,
	"next_move_markers": true,
	"visit_colours": true,

	"thumbnail_square_size": 4,

	"graph_type": 1,							// 1: Winrate   2: Score
	"minor_graph_linewidth": 1,
	"major_graph_linewidth": 2,
	"minor_graph_colour": "#444444ff",
	"major_graph_colour": "#4ba28bff",
	"major_graph_var_colour": "#4b8ba2ff",
	"midline_graph_colour": "#222222ff",
	"graph_width": 192,
	"comment_box_height": 256,

	"tree_spacing": 24,
	"tree_off_colour": "#444444ff",
	"tree_main_colour": "#909090ff",
	"central_node_colour": "#d0ad75ff",

	"coordinates": false,
	"black_pov": false,

	"analysis_pv_len": 16,
	"wide_root_noise": 0.04,					// Until 1.5.9, this was a bool, but was called "widerootnoise"
	"report_every": 0.1,

	"ownership_marks": 1,						// 0: None   1: Dead stones   2: Whole board   3: Whole board (alt)
	"ownership_per_move": true,

	"zobrist_checks": true,
	"snappy_node_switch": true,
	"fast_first_report": true,

	"play_against_policy": false,
	"play_against_drunk": false,

	"autoscroll_delay": 1,

	"enable_hw_accel": false,
	"logfile": null,

	"width": 1333,
	"height": 780,
	"maxed": false,

	"tygem_3": false,
	"load_at_end": true,
	"guess_ruleset": false,
	"stone_counts": false,
	"autoanalysis_visits": 500,
	"default_rules": "Chinese",					// Used for game on startup, as well as when rules are "" (unknown).
	"default_komi": 7.5,						// Used for game on startup, but otherwise unknown komi is inferred as zero.

	"komi_options": [0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5, 5.5, 6, 6.5, 7, 7.5],
	"visit_options": [10, 25, 50, 100, 250, 500, 1000, 2500, 5000, 10000],

	"sgf_folder": "",
	"katago_folder": "",
	"kataconfig_folder": "",
	"weights_folder": "",

	"gtp_warning": "THE GTP INTERFACE IS EXPERIMENTAL AND UNSUPPORTED. BUT IF YOU MUST, EDIT THE FOLLOWING LINES...",
	"gtp_filepath": "",							// Must be edited by the user in config.json
	"gtp_argslist": [],							// Likewise.
};

// ---------------------------------------------------------------------------------------------------------------------------

let errortext = "";

exports.error = () => {
	return errortext;
};

// ---------------------------------------------------------------------------------------------------------------------------

exports.load = () => {

	let raw_read = null;

	try {
		if (fs.existsSync(exports.filepath)) {
			raw_read = fs.readFileSync(exports.filepath, "UTF-8");
			if (raw_read.length < 50 && raw_read.trim() === "") {
				raw_read = "{}";
			}
			Object.assign(config, JSON.parse(raw_read));
		}
		errortext = "";
	} catch (err) {
		console.log(`While loading ${exports.filename}:`);
		console.log(err.toString());
		errortext = err.toString();

		// We will try to extract any language setting so a good error message can be displayed...

		if (typeof raw_read === "string" && raw_read.length < 10000) {
			for (let language of Object.keys(translations)) {
				if (raw_read.includes(language)) {
					config.language = language;
					break;
				}
			}
		}
	}

	// Copy default values for any missing keys into the config...
	// We use a copy so that any objects that are assigned are not the default objects.

	let defaults_copy = JSON.parse(JSON.stringify(exports.defaults));

	for (let key of Object.keys(defaults_copy)) {
		if (!config.hasOwnProperty(key)) {
			config[key] = defaults_copy[key];
		}
	}

	apply_fixes();
};

function apply_fixes() {

	// Reset some stuff every time...

	config.editing = exports.defaults.editing;
	config.play_against_policy = exports.defaults.play_against_policy;
	config.play_against_drunk = exports.defaults.play_against_drunk;

	// Someone might edit the numbers in a slightly wrong way...

	config.numbers = config.numbers.split("+").map(z => z.trim()).join(" + ");
	config.numbers = config.numbers.split(",").map(z => z.trim()).join(" + ");

	// Someone might edit HTML colour codes...

	for (let [key, defval] of Object.entries(exports.defaults)) {
		if (typeof defval === "string" && defval.startsWith("#")) {
			let fixed = fix_html_colour(config[key]);
			if (fixed !== config[key]) {
				console.log(`Adjusted config.${key} from "${config[key]}" to "${fixed}"`);
				config[key] = fixed;
			}
		}
	}

	// Someone might write booleans as strings...

	for (let key of Object.keys(config)) {
		if (config[key] === "false" || config[key] === "true") {
			let fixed = config[key] === "true";
			console.log(`Adjusted config.${key} from "${config[key]}" to ${fixed}`);
			config[key] = fixed;
		}
	}

	// Ensure validity of some (possibly user-edited) numeric arrays...

	for (let key of ["komi_options", "visit_options"]) {
		if (!Array.isArray(config[key]) || config[key].length === 0) {
			config[key] = Array.from(exports.defaults[key]);
			console.log(`Invalid config.${key}... replacing with default`);
		}
		for (let n of config[key]) {
			if (typeof n !== "number") {
				config[key] = Array.from(exports.defaults[key]);
				console.log(`Invalid config.${key} (interval value)... replacing with default`);
				break;
			}
		}
		config[key].sort((a, b) => a - b);
	}

	// Fix some stuff that used to be stored stringly-typed...

	if (config.ownership_marks === "None") config.ownership_marks = 0;
	if (config.ownership_marks === "Dead stones") config.ownership_marks = 1;
	if (config.ownership_marks === "Whole board") config.ownership_marks = 2;
	if (config.ownership_marks === "Whole board (alt)") config.ownership_marks = 3;

	if (typeof config.ownership_marks !== "number") {					// It was some other string? (Check *after* the above)
		config.ownership_marks = exports.defaults.ownership_marks;
	}

	if (config.graph_type === "Winrate") config.graph_type = 1;
	if (config.graph_type === "Score") config.graph_type = 2;

	if (typeof config.graph_type !== "number") {						// It was some other string? (Check *after* the above)
		config.graph_type = exports.defaults.graph_type;
	}
}

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

	for (let key of Object.keys(config)) {
		if (out.hasOwnProperty(key)) {
			out[key] = config[key];
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

	if (fs.existsSync(exports.filepath)) {
		return;
	}

	exports.save();
};
