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
const {translate} = require("./translate");
const {new_query, compare_queries} = require("./query");

function new_gtp_engine() {

	let eng = Object.create(gtp_engine_prototype);
	eng.is_gtp = true;

	eng.exe = null;
	eng.filepath = "";
	eng.engineconfig = "";
	eng.weights = "";

	eng.version = [99, 99, 99];						// Just because some code expected us to have this. Not updated.
	eng.known_commands = [];

	eng.running = null;
	eng.desired = null;

	eng.has_quit = false;

	eng.pending_commands = Object.create(null);		// gtp id --> query string		// only for some special queries
	eng.pending_nodes = Object.create(null);		// gtp id --> node id			// for analysis queries

	eng.next_gtp_id = 1;
	eng.current_incoming_gtp_id = null;

	return eng;

}

let gtp_engine_prototype = {

	__send: function(s) {

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

			if (s === "list_commands") {						// FIXME / TODO
				this.pending_commands[gtp_id] = s;
			}

		} catch (err) {
			this.shutdown();
		}
	},

	__send_query: function(o) {
		// TODO
	},

	analyse: function(node) {

		if (!this.exe) {
			ipcRenderer.send("set_check_false", [translate("MENU_ANALYSIS"), translate("MENU_GO_HALT_TOGGLE")]);
			return;
		}

		ipcRenderer.send("set_check_true", [translate("MENU_ANALYSIS"), translate("MENU_GO_HALT_TOGGLE")]);

		let query = new_query(node, this);

		if (this.desired) {
			if (compare_queries(this.desired, query)) {
				return;												// Everything matches; the search desired is already set as such.
			}
		}

		this.desired = query;

		if (this.running) {
			this.__send("version");
		} else {
			this.__send_query(this.desired);
			this.running = this.desired;
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

		this.__send("list_commands");

	},

	handle_stdout: function(line) {

		if (config.logfile) {
			this.log_received_string(line);
		}

		if (line === "") {
			return;															// FIXME: Should we set current_incoming_gtp_id to null?
		}

		if (line.startsWith("=")) {

			let id = parseInt(line.slice(1), 10);		// Relying on ParseInt not caring about gibberish after the number.

			if (!Number.isNaN(id)) {

				this.current_incoming_gtp_id = id;

				// Clear older and obsolete stuff in our maps...

				for (let key of Object.keys(this.pending_commands)) {
					let i = parseInt(key, 10);
					if (i < id) {
						delete this.pending_commands[i];
					}
				}
				for (let key of Object.keys(this.pending_nodes)) {
					let i = parseInt(key, 10);
					if (i < id) {
						delete this.pending_nodes[i];
					}
				}

				let space_index = line.indexOf(" ");
				if (space_index !== -1) {
					line = line.slice(space_index + 1);
				}

			}
		}

		let command = this.pending_commands[this.current_incoming_gtp_id];

		if (command) {
			if (command === "list_commands") {
				this.known_commands.push(line);
			}
		}

		let node_id = this.pending_nodes[this.current_incoming_gtp_id];

		if (node_id) {
			// TODO
		}
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
