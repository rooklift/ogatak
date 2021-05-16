"use strict";

const child_process = require("child_process");
const fs = require("fs");
const path = require("path");
const readline = require("readline");
const {ipcRenderer} = require("electron");

const stringify = require("./stringify");
const {node_id_from_search_id} = require("./utils");
const {base_query, full_query, full_query_matches_base} = require("./query");

function new_engine() {

	let eng = Object.create(engine_prototype);

	eng.exe = null;
	eng.filepath = "";
	eng.weights = "";

	eng.running = null;			// The search object actually running.
	eng.desired = null;			// The search object we want to be running - possibly the same object as above.

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
		}
	},

	analyse: function(node) {

		if (!this.exe) {
			return;
		}

		if (this.desired) {
			let hypothetical_base = base_query(node);
			if (full_query_matches_base(this.desired, hypothetical_base)) {
				return;				// Because everything matches - the search desired is already set as such.
			}
		}

		this.desired = full_query(node);
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
		ipcRenderer.send("set_check_false", ["Analysis", "Go / halt toggle"]);
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
			if (config.stderr_to_console) {
				console.log("! " + line);
			}
			if (line.startsWith("Beginning GPU tuning")) {
				alert("KataGo is currently tuning itself, this may take some time." + (config.stderr_to_console ? " Open the dev console to see its progress." : ""));
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
