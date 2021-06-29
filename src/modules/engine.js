"use strict";

const child_process = require("child_process");
const fs = require("fs");
const path = require("path");
const readline = require("readline");
const {ipcRenderer} = require("electron");

const stringify = require("./stringify");
const {node_id_from_search_id, parse_version} = require("./utils");
const {base_query, full_query, full_query_matches_base} = require("./query");

function new_engine() {

	let eng = Object.create(engine_prototype);

	eng.exe = null;
	eng.filepath = "";
	eng.weights = "";

	eng.version = [0, 0, 0];	// Gets updated to something like [1, 9, 0]

	eng.running = null;			// The search object actually running.
	eng.desired = null;			// The search object we want to be running - possibly the same object as above.

	eng.has_quit = false;

	// Our canonical concept of "state" is that the app is trying to ponder if desired is not null,
	// therefore every time desired is set, the relevant menu check should be set.

	return eng;
}

let engine_prototype = {

	__send: function(o) {
		if (!this.exe) {
			return;
		}
		if (typeof o !== "object") {
			throw "__send() requires an object";
		}
		try {
			let msg = JSON.stringify(o);
			this.exe.stdin.write(msg);
			this.exe.stdin.write("\n");
		} catch (err) {
			alert("While sending to engine:\n" + err.toString());
			this.shutdown();
		}
	},

	analyse: function(node) {

		if (!this.exe) {
			return;
		}

		if (this.desired) {
			let hypothetical_base = base_query(node, this);
			if (full_query_matches_base(this.desired, hypothetical_base)) {
				return;				// Because everything matches - the search desired is already set as such.
			}
		}

		this.desired = full_query(node, this);
		ipcRenderer.send("set_check_true", ["Analysis", "Go / halt toggle"]);

		if (this.running) {
			this.__send({
				id: `stop!${this.running.id}`,
				action: "terminate",
				terminateId: `${this.running.id}`
			});
		} else {
			this.__send(this.desired);
			this.running = this.desired;
		}
	},

	halt: function() {

		if (!this.exe) {
			return;
		}

		if (this.running) {
			this.__send({
				id: `stop!${this.running.id}`,
				action: "terminate",
				terminateId: `${this.running.id}`
			});
		}

		this.desired = null;
		ipcRenderer.send("set_check_false", ["Analysis", "Go / halt toggle"]);
	},

	setup: function(filepath, engineconfig, weights) {

		if (this.exe || this.has_quit) {
			throw "Engine object should not be reused!";
		}

		this.filepath     = fs.existsSync(filepath)     ? filepath     : "";
		this.engineconfig = fs.existsSync(engineconfig) ? engineconfig : "";
		this.weights      = fs.existsSync(weights)      ? weights      : "";

		if (!this.filepath || !this.engineconfig || !this.weights) {
			return;
		}

		try {
			this.exe = child_process.spawn(
				this.filepath,
				["analysis", "-config", this.engineconfig, "-model", this.weights],
				{cwd: path.dirname(this.filepath)}
			);
		} catch (err) {
			return;
		}

		this.__send({id: "query_version", action: "query_version"});

		this.create_scanners();
	},

	setup_with_command(command, argslist) {

		if (this.exe || this.has_quit) {
			throw "Engine object should not be reused!";
		}

		if (Array.isArray(argslist) === false) {
			argslist = [];
			alert("Engine argslist was ignored because it was not an array.");
		}

		try {
			this.exe = child_process.spawn(command, argslist);
		} catch (err) {
			return;
		}

		this.exe.once("error", (err) => {
			alert("Got exe error:\n" + err.toString());
			this.shutdown();
		});

		this.exe.stdin.once("error", (err) => {
			alert("Got exe.stdin error:\n" + err.toString());
			this.shutdown();
		});

		this.create_scanners();
	},

	create_scanners: function() {

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
			if (this.has_quit) {
				return;
			}
			let o;
			try {
				o = JSON.parse(line);
			} catch (err) {
				alert("Engine said:\n" + line);						// We got some non-JSON line.
				return;
			}
			if (o.error || o.warning) {
				alert("Engine said:\n" + stringify(o));
			}
			if (o.action === "query_version") {
				this.version = parse_version(o.version);
				if (this.version[0] === 1 && this.version[1] === 9 && this.version[2] === 0) {
					alert("This exact version of KataGo (1.9.0) is known to crash under Ogatak, consider downgrading or upgrading.");
				}
			}
			if (o.isDuringSearch === false || o.error) {
				if (this.running && this.running.id === o.id) {		// The current search has terminated.
					if (this.desired === this.running) {
						this.desired = null;
						ipcRenderer.send("set_check_false", ["Analysis", "Go / halt toggle"]);
					}
					this.running = null;
					if (this.desired) {
						this.__send(this.desired);
						this.running = this.desired;
					}
				}
			}
			hub.receive_object(o);
		});

		this.err_scanner.on("line", (line) => {
			if (this.has_quit) {
				return;
			}
			if (config.stderr_to_console) {
				console.log("! " + line);
			}
			if (line.startsWith("Beginning GPU tuning")) {
				alert("KataGo is currently tuning itself, this may take some time." + (config.stderr_to_console ? " Open the dev console to see its progress." : ""));
			}
			if (line.includes("exception")) {
				alert("KataGo said:\n" + line);
			}
		});

	},

	problem_text: function() {
		if (this.exe) return "";
		if (!this.filepath) return "Engine not set";
		if (!this.engineconfig) return "Engine config not set";
		if (!this.weights) return "Weights not set";
		return `Engine (${path.basename(this.filepath)}) not running`;
	},

	shutdown: function() {				// Note: Don't reuse the engine object.
		this.has_quit = true;
		if (this.exe) {
			this.exe.kill();
		}
		this.exe = null;
		this.running = null;
		this.desired = null;
	},
};



module.exports = new_engine;
