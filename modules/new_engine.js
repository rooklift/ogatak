"use strict";

const child_process = require("child_process");
const fs = require("fs");
const path = require("path");
const readline = require("readline");

function new_engine() {

	let eng = Object.create(null);

	eng.exe = null;
	eng.filepath = "";
	eng.weights = "";

	Object.assign(eng, eng_props);
	return eng;
};

let eng_props = {

	setup: function(filepath, engineconfig, weights) {

		if (!fs.existsSync(filepath) || !fs.existsSync(engineconfig) || !fs.existsSync(weights)) {
			return;
		}

		try {
			this.exe = child_process.spawn(filepath, ["analysis", "-config", engineconfig, "-model", weights], {cwd: path.dirname(filepath)});
		} catch (err) {
			console.log(`engine.setup() failed: ${err.toString()}`);
			return false;
		}

		this.filepath = filepath;
		this.weights = weights;

		this.scanner = readline.createInterface({
			input: this.exe.stdout,
			output: undefined,
			terminal: false
		});

		this.err_scanner = readline.createInterface({
			input: this.exe.stderr,
			output: undefined,
			terminal: false
		});

		this.scanner.on("line", (line) => {
			console.log("> " + line);
		});

		this.err_scanner.on("line", (line) => {
			console.log("! " + line);
		});

	},

};



module.exports = new_engine;
