"use strict";

// My initial plan is to have our GTP engine object have the same API
// as the normal one, including storing .running and .desired queries
// in the normal object format.
//
// When it comes to actually sending and receiving, we will convert
// to and from the object / string formats.
//
// We should also:
// - Store what commands are available
// - Store the current boardsize and komi

const child_process = require("child_process");
const fs = require("fs");
const path = require("path");
const readline = require("readline");

const log = require("./log");
const stringify = require("./stringify");

function new_gtp_engine() {

	let eng = Object.create(gtp_engine_prototype);
	eng.is_gtp = true;

	eng.exe = null;
	eng.filepath = "";
	eng.engineconfig = "";
	eng.weights = "";

	eng.running = null;
	eng.desired = null;

	eng.has_quit = false;
	// eng.tuning_in_progress = false;

	eng.id_query_map = Object.create(null);		// gtp id --> query string
	eng.id_node_map = Object.create(null);		// gtp id --> node id

	eng.next_gtp_id = 1;
	eng.current_incoming_gtp_id = null;

	return eng;

}

let gtp_engine_prototype = {

	__send: function(s, node_id) {

		if (!this.exe) {
			return;
		}

		if (typeof s !== "string") {
			throw new Error("__send(): requires a string");
		}

		let gtp_id = this.next_gtp_id++;
		let full = `${gtp_id} ${s}`;

		try {

			this.exe.stdin.write(full);
			this.exe.stdin.write("\n");

			if (config.logfile) {
				this.log_sent_string(full);
			}

			this.id_query_map[gtp_id] = s;

			if (node_id) {
				this.id_node_map[gtp_id] = node_id;
			}

		} catch (err) {
			this.shutdown();
		}
	},

	halt: function() {
		this.__send("version");
	},

	setup_with_command: function(command, argslist) {

		if (this.exe || this.has_quit) {
			throw new Error("setup_with_command(): engine object should not be reused");
		}

		if (!Array.isArray(argslist)) {
			argslist = [];
			alert("Engine argslist was ignored because it was not an array.");
		}

		try {
			this.exe = child_process.spawn(command, argslist);
		} catch (err) {
			return;
		}

		this.finish_setup();
	},

	finish_setup: function() {

		log("");
		log("-----------------------------------------------------------------------------------");
		log(`GTP startup at ${new Date().toUTCString()}`);

		this.exe.once("error", (err) => {
			this.log_and_alert("Got exe error:", err.toString());
			this.shutdown();
		});

		this.exe.once("exit", (code, signal) => {
			if (!this.has_quit) {
				this.log_and_alert("The engine appears to have quit.");
				this.shutdown();
			}
		});

		this.exe.stdin.once("error", (err) => {
			this.log_and_alert("Got exe.stdin error:", err.toString());
			this.shutdown();
		});

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
			this.handle_stdout(line);
		});

		this.err_scanner.on("line", (line) => {
			this.handle_stderr(line);
		});

	},

	handle_stdout: function(line) {

		if (config.logfile) {
			this.log_received_string(line);
		}

		// TODO
	},

	handle_stderr: function(line) {

		if (line.includes("exception")) {
			alert("GTP engine said:\n" + line);
		}

		if (this.has_quit) {
			return;
		}

		log("! " + line);

		stderrbox.receive(line);
	},

	problem_text: function() {
		if (this.exe) return "";
		return `GTP engine (${path.basename(this.filepath)}) not running.`;
	},

	shutdown: function() {

		this.has_quit = true;
		if (this.exe) {
			try {
				this.exe.stdin.end();
				this.exe.kill();
			} catch (err) {
				console.log(err);
			}
		}
		this.exe = null;
		this.running = null;
		this.desired = null;
	},

	log_sent_string: function(s) {
		log(s);
	},

	log_received_string: function(s) {
		log(s);
	},

	log_and_alert: function(...args) {
		log(args.join(" "));
		alert(args.join("\n"));
	},





};





module.exports = new_gtp_engine;
