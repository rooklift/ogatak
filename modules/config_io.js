"use strict";

const electron = require("electron");
const fs = require("fs");
const path = require("path");
const querystring = require("querystring");

exports.filename = "config.json";

// To avoid using "remote", we rely on the main process passing userData location in the query...

exports.filepath = electron.app ?
		path.join(electron.app.getPath("userData"), exports.filename) :									// in Main process
		path.join(querystring.parse(global.location.search)["?user_data_path"], exports.filename);		// in Renderer process

function Config() {};			// This exists solely to make instanceof work.
Config.prototype = {};

exports.defaults = {
	"width": 1280,
	"height": 835,
};

exports.load = () => {

	let cfg = new Config();
	let err_to_return = null;

	try {
		if (fs.existsSync(exports.filepath)) {
			Object.assign(cfg, JSON.parse(fs.readFileSync(exports.filepath, "utf8")));
		}
	} catch (err) {
		console.log(err.toString());
		err_to_return = err.toString();
	}

	// Copy default values for any missing keys into the config...
	// We use a copy so that any objects that are assigned are not the default objects.

	let defaults_copy = JSON.parse(JSON.stringify(exports.defaults));

	for (let key of Object.keys(defaults_copy)) {
		if (cfg.hasOwnProperty(key) === false) {
			cfg[key] = defaults_copy[key];
		}
	}

	return [err_to_return, cfg];
};

exports.save = (cfg) => {

	if (cfg instanceof Config === false) {
		throw "Wrong type of object sent to config_io.save()";
	}

	// Make a copy of the defaults. Doing it this way seems to
	// ensure the final JSON string has the same ordering...

	let out = JSON.parse(JSON.stringify(exports.defaults));

	// Adjust that copy, but only for keys present in both.

	for (let key of Object.keys(cfg)) {
		if (out.hasOwnProperty(key)) {
			out[key] = cfg[key];
		}
	}

	try {
		fs.writeFileSync(exports.filepath, JSON.stringify(out, null, "\t"));
	} catch (err) {
		console.log(err.toString());
	}
};

exports.create_if_needed = (cfg) => {

	// Note that this must be called fairly late, when userData directory exists.

	if (cfg instanceof Config === false) {
		throw "Wrong type of object sent to config_io.create_if_needed()";
	}

	if (fs.existsSync(exports.filepath)) {
		return;
	}

	exports.save(cfg);
};
