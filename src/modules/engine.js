"use strict";

const child_process = require("child_process");
const fs = require("fs");
const path = require("path");
const readline = require("readline");
const {ipcRenderer} = require("electron");

const log = require("./log");
const stringify = require("./stringify");
const {parse_version, compare_versions} = require("./utils");
const {base_query, finalise_query, full_query_matches_base} = require("./query");

const bad_versions = [			// Versions of KataGo which are somehow broken.
	[1, 9, 0],
];

function new_engine() {

	let eng = Object.create(engine_prototype);

	eng.exe = null;
	eng.filepath = "";
	eng.weights = "";

	eng.version = [99, 99, 99];	// Gets updated to something like [1, 9, 0]. Starts high to assume features are present if version not known.

	eng.running = null;			// The search object actually running.
	eng.desired = null;			// The search object we want to be running - possibly the same object as above.

	eng.has_quit = false;

	// Our canonical concept of "state" is that the app is trying to ponder if desired is not null,
	// therefore every time desired is set, the relevant menu check should be set.

	return eng;
}

let engine_prototype = {

	__send: function(o) {

		// Sends the object to the KataGo Analysis Engine by converting it to JSON and writing it to stdin.

		if (!this.exe) {
			return;
		}
		if (typeof o !== "object" || o === null) {
			throw "__send() requires an object";
		}
		try {
			let msg = JSON.stringify(o);
			this.exe.stdin.write(msg);
			this.exe.stdin.write("\n");
			if (o.moves) {
				log(`--> (Request ${o.id}, ${o.moves.length} moves)`);
			} else {
				log("--> " + msg);
			}
		} catch (err) {
			this.log_and_alert("While sending to engine:", err.toString());
			this.shutdown();
		}
	},

	analyse: function(node) {

		// Sets this.desired to be a query for the node.
		// If a query is currently running, sends a stop message to the engine.
		// Otherwise, sends the desired query to the engine, and sets this.running.

		if (!this.exe) {
			return;
		}

		let query = base_query(node, this);

		if (this.desired) {
			if (full_query_matches_base(this.desired, query)) {
				return;				// Because everything matches - the search desired is already set as such.
			}
		}

		finalise_query(query, node);
		this.desired = query;
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

		// Clears this.desired, and sends a stop message if required.

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

		this.finish_setup();
	},

	setup_with_command(command, argslist) {

		if (this.exe || this.has_quit) {
			throw "Engine object should not be reused!";
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
		log(`KataGo startup at ${new Date().toUTCString()}`);

		this.exe.once("error", (err) => {
			this.log_and_alert("Got exe error:", err.toString());
			this.shutdown();
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

		this.__send({id: "query_version", action: "query_version"});

		this.scanner.on("line", (line) => {
			if (this.has_quit) {
				return;
			}
			let o;
			try {
				o = JSON.parse(line);
				if (typeof o !== "object" || o === null) {
					throw "Got Non-object!";
				}
			} catch (err) {
				this.log_and_alert("Received non-JSON:", line);
				return;
			}
			this.log_received_object(o, line);
			if (o.error) {
				alert("Engine said:\n" + stringify(o));
			}
			if (o.warning) {
				console.log("Engine warning: " + o.warning);
			}
			if (o.action === "query_version") {
				this.version = parse_version(o.version);
				for (let bv of bad_versions) {
					if (compare_versions(bv, this.version) === 0) {
						alert(`This exact version of KataGo (${o.version}) is known to crash under Ogatak, consider downgrading or upgrading.`);
					}
				}
			}
			if (o.isDuringSearch === false || o.error) {			// Every analysis request generates exactly 1 of these eventually.
				if (this.running && this.running.id === o.id) {		// id matches the current search, which has therefore terminated.
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

			if (line.includes("exception")) {
				alert("KataGo said:\n" + line);
			}

			if (this.has_quit) {		// Do this after the above, so that exceptions that caused the quit can be displayed.
				return;
			}

			log("! " + line);

			if (config.stderr_to_console) {
				console.log("! " + line);
			}

			if (line.includes("Beginning GPU tuning")) {
				fullbox.enter_stderr_mode();
			}
			if (fullbox.stderr_mode) {
				fullbox.accept_stderr(line);
			}
			if (line.includes("ready to begin handling requests")) {
				fullbox.exit_stderr_mode();
			}

		});
	},

	log_received_object: function(o, line) {			// args are the object and the line that generated it
		if (o.rootInfo) {
			if (o.isDuringSearch) {
				log(`< [Update for ${o.id}, ${o.rootInfo.visits} visits]`);
			} else {
				log(`< [FINAL update for ${o.id}, ${o.rootInfo.visits} visits]`);
			}
		} else if (o.noResults) {
			log(`< [NO RESULTS update for ${o.id}]`);
		} else {
			log("< " + line);
		}
	},

	log_and_alert: function(...args) {
		log(args.join(" "));
		alert(args.join("\n"));
	},

	problem_text: function() {
		if (this.exe) return "";
		if (!this.filepath) return "Engine not set";
		if (!this.engineconfig) return "Engine config not set";
		if (!this.weights) return "Weights not set";
		return `Engine (${path.basename(this.filepath)}) not running`;
	},

	shutdown: function() {								// Note: Don't reuse the engine object.
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
