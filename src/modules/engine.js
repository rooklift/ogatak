"use strict";

const child_process = require("child_process");
const fs = require("fs");
const path = require("path");
const readline = require("readline");
const {ipcRenderer} = require("electron");

const stringify = require("./stringify");
const {node_id_from_search_id} = require("./utils");

function new_engine() {

	let eng = Object.create(engine_prototype);

	eng.exe = null;
	eng.filepath = "";
	eng.weights = "";

	eng.running = null;			// The search object actually running.
	eng.desired = null;			// The search object we want to be running - possibly the same object as above.

	// Our canonical concept of "state" is that the app is trying to ponder if desired is not null,
	// therefore every time desired is set, an ack should be sent to the main process.

	eng.suppressed_search_id = null;

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
		}
	},

	analyse: function(node) {

		if (!this.exe) {
			return;
		}

		let desired_has_widerootnoise = (this.desired && this.desired.overrideSettings.wideRootNoise) ? true : false;

		if (this.desired && node_id_from_search_id(this.desired.id) === node.id) {
			if (this.desired.komi === node.get_board().komi) {
				if (this.desired.rules === config.rules) {
					if (desired_has_widerootnoise === config.widerootnoise) {
						return;			// Because everything matches - the search desired is already set as such.
					}
				}
			}
		}

		this.desired = node.katago_query();
		ipcRenderer.send("ack_ponder", true);

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

	suppress: function() {

		// Further updates from this search get their id altered so as not to be recognised by the hub as belonging to its node.
		// They still get passed on, in case the hub has some other use for them.

		if (!this.exe) {
			return;
		}

		if (this.running) {
			this.suppressed_search_id = this.running.id;
		}
	},

	halt: function() {				// Only for user-caused halts, as it sets desired to null.

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
		ipcRenderer.send("ack_ponder", false);
	},

	setup: function(filepath, engineconfig, weights) {

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
			return false;
		}

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
			if (o.error || o.warning) {
				alert("Engine said:\n" + stringify(o));
			}
			if (o.isDuringSearch === false || o.error) {
				if (this.running && this.running.id === o.id) {
					if (this.desired === this.running) {
						this.desired = null;
						ipcRenderer.send("ack_ponder", false);
					}
					this.running = null;
					if (this.desired) {
						this.__send(this.desired);
						this.running = this.desired;
					}
				}
			}
			if (typeof o.id === "string" && o.id === this.suppressed_search_id) {
				o.id = "suppressed!" + o.id;
			}
			hub.receive_object(o);
		});

		this.err_scanner.on("line", (line) => {
			console.log("! " + line);
			if (line.startsWith("Beginning GPU tuning")) {
				alert("KataGo is currently tuning itself, this may take some time. Open the dev console to see its progress.");
			}
		});

	},

	problem_text: function() {
		if (this.exe) return "";
		if (!this.filepath) return "engine not set";
		if (!this.engineconfig) return "engine config not set";
		if (!this.weights) return "weights not set";
		return "engine not running";
	},

	shutdown: function() {				// Note: Don't reuse the engine object.
		if (this.exe) {
			this.exe.kill();
		}
	},

};



module.exports = new_engine;
