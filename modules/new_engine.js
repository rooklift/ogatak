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

	eng.current_analysis_id = null;		// The full id of the running analysis, as a string.

	Object.assign(eng, eng_props);
	return eng;
};

let eng_props = {

	__send: function(msg) {
		if (!this.exe) {
			return;
		}
		msg = msg.trim();
		try {
			this.exe.stdin.write(msg);
			this.exe.stdin.write("\n");
			console.log("> " + msg);
		} catch (err) {
			console.log(err.toString());
		}
	},

	analyse: function(node) {
		let o = node.katago_query();
		if (this.current_analysis_id === o.id) {
			return;
		}
		this.halt();
		this.current_analysis_id = o.id;
		this.__send(JSON.stringify(o));
	},

	halt: function() {
		if (this.current_analysis_id) {
			this.__send(`{"id":"xxx","action":"terminate","terminateId":"${this.current_analysis_id}"}`);
		}
	},

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
			let o = JSON.parse(line);
			if (o.isDuringSearch === false) {
				if (o.id === this.current_analysis_id) {
					this.current_analysis_id = null;
				}
			}
			console.log("< " + line);
		});

		this.err_scanner.on("line", (line) => {
			console.log("! " + line);
		});

	},

};



module.exports = new_engine;
