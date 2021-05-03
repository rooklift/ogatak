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
	"width": 640,
	"height": 700,

	"square_size": 40,

	"engine": "",
	"engineconfig": "",
	"weights": "",

	"numbers": "winrate",
	"next_move_markers": true,

	"next_size": 19,
	"next_komi": 7.5,
	"next_handicap": 0,

	"visits_threshold": 0.02,

	"rules": "chinese",
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
