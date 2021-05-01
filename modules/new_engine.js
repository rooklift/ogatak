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

	eng.current_analysis_id = null;		// The id of the node will equal the id in the sent JSON.
	eng.pending_send = null;

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
		} catch (err) {
			console.log(err.toString());
		}
	},

	analyse: function(node) {

		if (this.current_analysis_id === node.id) {
			this.pending_send = null;
			return;
		}

		if (this.pending_send && this.pending_send.id === node.id) {
			return;
		}

		let o = node.katago_query();

		if (this.current_analysis_id) {
			this.halt();
			this.pending_send = o;
		} else {
			this.current_analysis_id = o.id;
			this.__send(JSON.stringify(o));
			this.pending_send = null;
		}
	},

	halt: function() {
		if (this.current_analysis_id) {
			this.__send(`{"id":"xxx_${this.current_analysis_id}","action":"terminate","terminateId":"${this.current_analysis_id}"}`);
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
					if (this.pending_send) {
						this.current_analysis_id = this.pending_send.id;
						this.__send(JSON.stringify(this.pending_send));
						this.pending_send = null;
					}
				}
			}
			hub.receive_object(o);
		});

		this.err_scanner.on("line", (line) => {
			console.log("! " + line);
		});

	},

};



module.exports = new_engine;
