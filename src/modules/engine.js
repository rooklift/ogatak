"use strict";

const child_process = require("child_process");
const fs = require("fs");
const path = require("path");
const readline = require("readline");
const {ipcRenderer} = require("electron");

const log = require("./log");
const stringify = require("./stringify");
const {translate} = require("./translate");
const {parse_version, compare_versions} = require("./utils");
const {new_query, compare_queries} = require("./query");

const bad_versions = [					// Versions of KataGo which are somehow broken.
	[1, 9, 0],
];

function new_engine() {

	let eng = Object.create(engine_prototype);

	eng.is_gtp = false;
	eng.has_quit = false;
	eng.exe = null;

	eng.received_version = false;		// Indicates that KataGo has really started responding to commands.
	eng.version = [99, 99, 99];			// Gets updated to something like [1, 9, 0]. Starts high to assume features are present if version not known.
	eng.tuning_in_progress = false;

	eng.filepath = "";
	eng.engineconfig = "";
	eng.weights = "";

	eng.desired = null;					// The search object we want to be running.
	eng.running = null;					// The search object actually running. (Possibly the same object as above.)

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
			throw new Error("__send(): requires an object");
		}
		try {
			let msg = JSON.stringify(o);
			this.exe.stdin.write(msg);
			this.exe.stdin.write("\n");
			if (config.logfile) {									// This test is just to save effort; the logging function checks this also.
				this.log_sent_object(o);
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

		ipcRenderer.send("set_check_false", [translate("MENU_ANALYSIS"), translate("MENU_GO_HALT_TOGGLE")]);

		this.desired = null;

		if (this.running) {
			this.__send({
				id: `stop!${this.running.id}`,
				action: "terminate",
				terminateId: `${this.running.id}`
			});
		}
	},

	setup: function(filepath, engineconfig, weights) {

		if (this.exe || this.has_quit) {
			throw new Error("setup(): engine object should not be reused");
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
				["analysis", "-config", this.engineconfig, "-model", this.weights, "-quit-without-waiting"],
				{cwd: path.dirname(this.filepath)}
			);
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

		this.exe.once("exit", (code, signal) => {
			if (!this.has_quit) {											// Only act if this is unexpected.
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

		this.__send({id: "query_version", action: "query_version"});

		this.scanner.on("line", (line) => {
			if (this.has_quit) {
				return;
			}
			let o;
			try {
				o = JSON.parse(line);
				if (typeof o !== "object" || o === null) {
					throw new Error("scanner: got non-object");
				}
				if (config.logfile) {								// This test is just to save effort; the logging function checks this also.
					this.log_received_object(o);
				}
			} catch (err) {
				this.log_and_alert("Received non-JSON:", line);
				return;
			}
			if (o.error) {
				alert("Engine said:\n" + stringify(o));
			}
			if (o.warning) {
				console.log("Engine warning: " + o.warning);
			}
			if (o.action === "query_version") {
				this.version = parse_version(o.version);
				this.received_version = true;
				for (let bv of bad_versions) {
					if (compare_versions(bv, this.version) === 0) {
						alert(`This exact version of KataGo (${o.version}) is known to crash under Ogatak, consider downgrading or upgrading.`);
					}
				}
			}
			let running_has_finished = false;
			if (o.action === "terminate") {									// We get these back when we explicitly end a search, which we usually do.
				if (this.running && this.running.id === o.terminateId) {	// However, it may send updates in a little bit (10-100 ms or so).
					running_has_finished = true;							
				}
			}
			if (o.isDuringSearch === false || o.error) {					// Every analysis request generates exactly 1 of these eventually.
				if (this.running && this.running.id === o.id) {				// Upon receipt, the search is completely finished.
					running_has_finished = true;							
				}
			}
			if (running_has_finished) {
				if (this.desired === this.running) {
					this.desired = null;
					ipcRenderer.send("set_check_false", [translate("MENU_ANALYSIS"), translate("MENU_GO_HALT_TOGGLE")]);
				}
				this.running = null;
				if (this.desired) {
					this.__send(this.desired);
					this.running = this.desired;
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
			stderrbox.receive(line);
			if (line.includes("Beginning GPU tuning") || line.includes("Creating new timing cache")) {
				this.tuning_in_progress = true;
				stderrbox.show();
			}
			if (line.includes("ready to begin handling requests")) {
				if (this.tuning_in_progress) {
					this.tuning_in_progress = false;
					stderrbox.hide();
				}
			}
		});
	},

	log_received_object: function(o) {

		let redacted = {};

		for (let [key, value] of Object.entries(o)) {
			if (key !== "moveInfos" && key !== "ownership") {
				redacted[key] = value;								// Note this is a shallow copy, so we must not do anything destructive to it.
			} else {
				redacted[key] = ["redacted"];
			}
		}

		log("< " + JSON.stringify(redacted));
	},

	log_sent_object: function(o) {

		let redacted = {};

		for (let [key, value] of Object.entries(o)) {
			if (key !== "moves") {
				redacted[key] = value;								// Note this is a shallow copy, so we must not do anything destructive to it.
			} else {
				redacted[key] = ["redacted"];
			}
		}

		log("\n--> " + JSON.stringify(redacted) + "\n");
	},

	log_and_alert: function(...args) {
		log(args.join(" "));
		alert(args.join("\n"));
	},

	problem_text: function() {
		if (this.exe) return "";
		if (!this.filepath) return translate("GUI_ENGINE_NOT_SET");
		if (!this.engineconfig) return translate("GUI_ENGINE_CONFIG_NOT_SET");
		if (!this.weights) return translate("GUI_WEIGHTS_NOT_SET");
		return `Engine (${path.basename(this.filepath)}) not running.`;
	},

	shutdown: function() {											// Note: Don't reuse the engine object.

		this.has_quit = true;										// Do this first so we know to ignore the "exit" event generated next...
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
};



module.exports = new_engine;
