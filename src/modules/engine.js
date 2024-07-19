"use strict";

// Notes:
//
// We only ever have one query active at a time, so we must receive an indication that the
// previous query has terminated (or at least is terminating) before sending the next one.
//
// Our canonical concept of "state" is that the app is trying to ponder if desired != null

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

const bad_versions = [						// Versions of KataGo which are somehow broken.
	[1, 9, 0],
];

function new_engine(...args) {
	return new Engine(...args);
}

class Engine {

	constructor() {

		this.is_gtp = false;
		this.has_quit = false;
		this.exe = null;

		this.received_version = false;		// Indicates that KataGo has really started responding to commands.
		this.version = [1, 0, 0];			// Gets updated to something like [1, 9, 0].
		this.tuning_in_progress = false;

		this.filepath = "";
		this.engineconfig = "";
		this.weights = "";

		// Note that the following will not be null'd just because we receive {isDuringSearch: false}
		// results, rather they will be left in place to indicate that the app still wants to ponder if
		// the position changes - which will likely happen immediately as the hub receives the search
		// results and changes the position based on what play mode it is in (e.g. autoplay, etc).

		this.desired = null;				// The search object we want to be running.
		this.running = null;				// The search object actually running. (Possibly the same object as above.)
	}

	__send(o) {

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
	}

	analyse(node, maxvisits = null, avoid_list = null) {

		// Sets this.desired to be a query for the node.
		// If a query is currently running, sends a stop message to the engine.
		// Otherwise, sends the desired query to the engine, and sets this.running.

		if (!this.exe) {
			return;
		}

		let query = new_query(node, this.version, maxvisits, avoid_list);

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
	}

	halt() {

		// Clears this.desired, and sends a stop message if required.

		this.desired = null;

		if (this.running) {
			this.__send({
				id: `stop!${this.running.id}`,
				action: "terminate",
				terminateId: `${this.running.id}`
			});
		}
	}

	setup(filepath, engineconfig, weights) {

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
			this.log_and_alert("While spawning engine:", err.toString());
			return;
		}

		this.finish_setup();
	}

	finish_setup() {

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
		this.__send({id: "test_bs29", rules: "Chinese", boardXSize: 29, boardYSize: 29, maxVisits: 1, moves: []});

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
			if (o.id === "test_bs29") {											// Before the main check for errors.
				if (!o.error) {
					this.log_and_alert(
						"This build of KataGo appears to be compiled with \"bs29\" support for board sizes above 19. " +
						"This build will be significantly slower. Consider installing the normal version."
					);
				}
				return;
			}
			// KataGo 1.15.0 sends a mistaken error when sent the "query_version" command. We should ignore it once.
			if (o.error === "'action' field must be 'query_version' or 'terminate' or 'terminate_all'") {
				if (compare_versions([1, 15, 0], this.version) === 0) {
					if (!this.saw_bad_1_15_0_error) {
						this.saw_bad_1_15_0_error = true;						// We only expect to see this once. Any further events are real errors I guess.
						return;
					}
				}
			}
			// From here on we don't return early but try to use the object in any event...
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
			if (o.action === "terminate") {										// We get these back very quickly upon sending a "terminate", however
				if (this.running && this.running.id === o.terminateId) {		// Kata may send further updates in a little bit (10-100 ms or so).
					running_has_finished = true;
				}
			}
			if (o.error) {
				if (this.running && this.running.id === o.id) {
					running_has_finished = true;
				}
			}

//			SINCE OGATAK 1.9.6 WE DON'T CARE WHETHER KATAGO ENDED ITS SEARCH
//			if (o.isDuringSearch === false) {									// Every analysis request generates exactly 1 of these eventually.
//				if (this.running && this.running.id === o.id) {					// Upon receipt, the search is completely finished.
//					running_has_finished = true;
//				}
//			}

			if (running_has_finished) {
				if (this.desired === this.running) {
					this.desired = null;
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
	}

	log_received_object(o) {

		let redacted = {};

		for (let [key, value] of Object.entries(o)) {
			if (!["moveInfos", "ownership", "policy"].includes(key)) {
				redacted[key] = value;								// Note this is a shallow copy, so we must not do anything destructive to it.
			} else {
				redacted[key] = ["redacted"];
			}
		}

		log("< " + JSON.stringify(redacted));
	}

	log_sent_object(o) {

		let redacted = {};

		for (let [key, value] of Object.entries(o)) {
			if (key !== "moves") {
				redacted[key] = value;								// Note this is a shallow copy, so we must not do anything destructive to it.
			} else {
				redacted[key] = ["redacted"];
			}
		}

		log("\n--> " + JSON.stringify(redacted) + "\n");
	}

	log_and_alert(...args) {
		log(args.join(" "));
		console.log(args.join(" "));
		alert(args.join("\n"));
	}

	problem_text() {
		if (this.exe) return "";
		if (!this.filepath) return translate("GUI_ENGINE_NOT_SET");
		if (!this.engineconfig) return translate("GUI_ENGINE_CONFIG_NOT_SET");
		if (!this.weights) return translate("GUI_WEIGHTS_NOT_SET");
		return `Engine (${path.basename(this.filepath)}) not running.`;
	}

	shutdown() {													// Note: Don't reuse the engine object.

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
	}
}



module.exports = new_engine;
