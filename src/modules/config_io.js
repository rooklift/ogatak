"use strict";

// Remember this will run twice in 2 different processes, so don't autosave etc.

const electron = require("electron");
const fs = require("fs");
const path = require("path");

const {fix_html_colour} = require("./html_colours");
const {get_href_query_val} = require("./utils");
const colour_choices = require("./colour_choices");

exports.filename = "config.json";

// To avoid using "remote", we rely on the main process passing userData location in the query...

exports.filepath = electron.app ?
		path.join(electron.app.getPath("userData"), exports.filename) :			// in Main process
		path.join(get_href_query_val("user_data_path"), exports.filename);		// in Renderer process

// ---------------------------------------------------------------------------------------------------------------------------

global.config = {};

exports.defaults = {

	// ---------------------------------------------------------
	// REMEMBER, WHEN ADDING THINGS, ALSO ADD TO hub_settings.js
	// ---------------------------------------------------------

	"arbitrary_command": "",					// Must be edited by the user in config.json
	"arbitrary_argslist": [],					// Likewise.

	"engine": "",
	"engineconfig": "",
	"weights": "",

	"mode": "",									// Reset at launch.

	"board_line_width": 1,
	"grid_colour": "#000000ff",

	"square_size": 36,

	"info_font_size": 16,

	"board_font_size": 14,
	"top_colour_black": colour_choices.blue,
	"top_colour_white": colour_choices.blue,
	"off_colour_black": colour_choices.green,
	"off_colour_white": colour_choices.green,
	"wood_colour": "#d0ad75ff",					// Average of our board image, as claimed by matkl.github.io/average-color
	"previous_marker": "#ff6666ff",
	"candidate_moves": true,
	"numbers": "LCB + Visits",					// Lame stringly typed
	"visits_threshold": 0.02,
	"mouseover_pv": true,
	"next_move_markers": true,
	"visit_colours": true,

	"thumbnail_square_size": 4,

	"graph_type": "Winrate",					// Lame stringly typed
	"minor_graph_linewidth": 1,
	"major_graph_linewidth": 2,
	"minor_graph_colour": "#444444ff",
	"major_graph_colour": "#4ba28bff",
	"major_graph_var_colour": "#4b8ba2ff",
	"midline_graph_colour": "#222222ff",
	"graph_width": 224,
	"comment_height": 0,

	"tree_spacing": 24,
	"tree_off_colour": "#444444ff",
	"tree_main_colour": "#909090ff",
	"central_node_colour": "#d0ad75ff",

	"analysis_pv_len": 16,
	"widerootnoise": true,
	"symmetry_pruning": true,
	"report_every": 0.1,

	"ownership_marks": "Dead stones",			// Lame stringly typed
	"ownership_per_move": true,

	"logfile": null,
	"width": 1200,
	"height": 780,
	"maxed": false,
	"auto_square_size": true,
	"stderr_to_console": true,
	"load_at_end": true,
	"autoanalysis_visits": 500,
	"default_rules": "Chinese",					// Used for game on startup, as well as when rules are "Unknown".
	"default_komi": 7.5,						// Used for game on startup, but otherwise unknown komi is inferred as zero.

	"sgf_folder": "",
	"katago_folder": "",
	"kataconfig_folder": "",
	"weights_folder": "",
};

// ---------------------------------------------------------------------------------------------------------------------------

let errortext = "";

exports.error = () => {
	return errortext;
};

// ---------------------------------------------------------------------------------------------------------------------------

exports.load = () => {

	try {
		if (fs.existsSync(exports.filepath)) {
			Object.assign(config, JSON.parse(fs.readFileSync(exports.filepath, "UTF-8")));
		}
		errortext = "";
	} catch (err) {
		console.log(`While loading ${exports.filename}:`);
		console.log(err.toString());
		errortext = err.toString();
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

	// Reset mode every time...

	config.mode = exports.defaults.mode;

	// Someone might edit the numbers in a slightly wrong way...

	config.numbers = config.numbers.split("+").map(z => z.trim()).join(" + ");
	config.numbers = config.numbers.split(",").map(z => z.trim()).join(" + ");

	// Make the wood_colour var match the wood_colour.json file, if possible...

	try {
		let j = JSON.parse(fs.readFileSync(path.join(__dirname, "../gfx/wood_colour.json")));
		if (typeof j === "object" && j !== null && typeof j.value === "string") {
			if (j.value.startsWith("#") && j.value.length === 9) {
				if (config.wood_colour !== j.value) {
					config.wood_colour = j.value;
					console.log("Adjusted config.wood_colour to match wood_colour.json");
				}
			} else {
				console.log(`wood_colour.json: bad colour string`);
			}
		} else {
			console.log(`wood_colour.json: bad object`);
		}
	} catch (err) {
		console.log(`wood_colour.json: ${err.toString()}`);
	}

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
