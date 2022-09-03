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
const {ipcRenderer} = require("electron");

const log = require("./log");
const {translate} = require("./translate");
const {new_query, compare_queries} = require("./query");
const {node_id_from_search_id} = require("./utils");

function new_gtp_engine() {

	let eng = Object.create(gtp_engine_prototype);
	eng.is_gtp = true;

	eng.exe = null;
	eng.filepath = "";
	eng.engineconfig = "";
	eng.weights = "";

	eng.received_version = false;					// Indicates when the engine has really started responding.
	eng.known_commands = [];

	eng.running = null;
	eng.desired = null;

	eng.width = null;
	eng.height = null;

	eng.has_quit = false;

	eng.pending_commands = Object.create(null);		// gtp id --> query string		// Only for some special queries.
	eng.pending_queries = Object.create(null);		// gtp id --> query id			// For analysis queries. Note query_id is like "node_123:456"

	eng.next_gtp_id = 1;
	eng.current_incoming_gtp_id = null;				// The last seen =id number from the engine e.g. =123

	return eng;

}

let gtp_engine_prototype = {

	__send: function(s) {		// Returns the GTP id number which was sent

		if (!this.exe) {
			return null;
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

			if (["version", "list_commands"].includes(s)) {
				this.pending_commands[gtp_id] = s;
			}

		} catch (err) {
			this.shutdown();
			return null;
		}

		return gtp_id;

	},

	__send_query: function(o) {

		// FIXME / TODO - sizes, komi
		// Also, this method seems appallingly slow.

		this.__send("clear_board");

		for (let move of o.initialStones) {
			this.__send(`play ${move[0]} ${move[1]}`);
		}

		for (let move of o.moves) {
			this.__send(`play ${move[0]} ${move[1]}`);
		}

		// TODO

		let node_id = node_id_from_search_id(o.id);

		let colour;

		if (o.moves.length > 0) {
			let last_colour = o.moves[o.moves.length - 1][0];
			if (last_colour === "W" || last_colour === "w") {
				colour = "B";
			} else {
				colour = "W";
			}
		} else if (o.initialPlayer) {
			colour = o.initialPlayer;
		} else {
			colour = "B";
		}

		let gtp_id = this.__send(`lz-analyze ${colour} ${o.reportDuringSearchEvery * 100}`);

		this.pending_queries[gtp_id] = o.id;

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
		this.__send("protocol_version");
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
			this.exe = child_process.spawn(command, argslist, {cwd: path.dirname(command)});
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
		this.__send("version");

	},

	handle_stdout: function(line) {

		// FIXME - colour won't always be B

		if (config.logfile) {
			this.log_received_string(line);
		}

		if (line === "") {

			let query_id = this.pending_queries[this.current_incoming_gtp_id];		// Maybe we were receiving analysis for some query. Start a new one?

			if (query_id && query_id === this.running.id) {

				if (this.desired === this.running) {
					this.desired = null;
					ipcRenderer.send("set_check_false", [translate("MENU_ANALYSIS"), translate("MENU_GO_HALT_TOGGLE")]);
				}
				this.running = null;
				if (this.desired) {
					this.__send_query(this.desired);
					this.running = this.desired;
				}

			}

			this.current_incoming_gtp_id = null;						// After the above.

			return;
		}

		if (line.startsWith("?")) {
			this.current_incoming_gtp_id = null;						// FIXME: Report errors?
		}

		if (line.startsWith("=")) {

			let id = parseInt(line.slice(1), 10);						// Relying on ParseInt not caring about gibberish after the number.

			if (!Number.isNaN(id)) {

				this.current_incoming_gtp_id = id;

				// Clear older and obsolete stuff in our "pending" maps...

				for (let key of Object.keys(this.pending_commands)) {
					let i = parseInt(key, 10);
					if (i < id) {
						delete this.pending_commands[i];
					}
				}
				for (let key of Object.keys(this.pending_queries)) {
					let i = parseInt(key, 10);
					if (i < id) {
						delete this.pending_queries[i];
					}
				}

				let space_index = line.indexOf(" ");
				if (space_index !== -1) {
					line = line.slice(space_index + 1);
				} else {
					line = "";
				}

			}
		}

		let command = this.pending_commands[this.current_incoming_gtp_id];

		if (command) {
			if (command === "list_commands") {
				this.known_commands.push(line);
			}
			if (command === "version") {
				this.received_version = true;
				hub.receive_object({action: "query_version"});					// The hub expects to receive this, to trigger a draw().
			}
		}

		let query_id = this.pending_queries[this.current_incoming_gtp_id];		// Something like "node_123:456"

		if (query_id) {

			// TODO / in-progress

			let o = {
				id: query_id,
				moveInfos: [],
				rootInfo: {
					scoreLead: 0,		// FIXME: add null default values, and have checks for null in every place in the code that looks at these.
					visits: 0,
					winrate: 0.5,
				},
			};

			let blocks = line.split("info ");

			for (let block of blocks) {

				if (block === "") {
					continue;
				}

				let tokens = block.split(" ");

				let info = {			// FIXME: add null default values, and have checks for null in every place in the code that looks at these.
					pv: [],
					scoreLead: 0,
				};

				let state = null;

				for (let token of tokens) {

					if (token === "") {
						continue;
					}

					if (["move", "visits", "winrate", "prior", "lcb", "order", "pv"].includes(token)) {
						state = token;
						continue;
					}

					if (state === "move") {
						info.move = token;
						state = null;
					}
					if (state === "visits") {
						info.visits = parseInt(token, 10);
						o.rootInfo.visits += info.visits;
						state = null;
					}
					if (state === "winrate") {
						info.winrate = parseInt(token, 10) / 10000;
						state = null;
					}
					if (state === "prior") {
						info.prior = parseInt(token, 10) / 10000;
						state = null;
					}
					if (state === "lcb") {
						info.lcb = parseInt(token, 10) / 10000;
						state = null;
					}
					if (state === "order") {
						info.order = parseInt(token, 10);
						state = null;
					}
					if (state === "pv") {
						info.pv.push(token);
						// stay in state "pv"
					}
				}

				o.moveInfos.push(info);

			}

			if (o.moveInfos.length > 0) {
				hub.receive_object(o);
			}
			
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
