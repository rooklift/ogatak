"use strict";

// http://www.lysator.liu.se/~gunnar/gtp/gtp2-spec-draft2/gtp2-spec.html
//
// Ogatak is primarily a GUI for Katago via Katago's analysis engine,
// therefore using any program in GTP mode is not really recommended.
//
// Reasons not to use GTP:
// -- Some engines won't support non-7.5 komi.
// -- Some engines won't support non-19 boards, or rectangular boards.
// -- Some engines won't support different rulesets.
// -- No standard way to send ruleset anyway.
// -- Changing board sizes takes an eternity in KataGo.
// -- Engines won't support all our options, e.g. ownership.
// -- Hard to parse output.
// -- lz-analyze and kata-analyze have different output formats.
// -- Won't receive score with lz-analyze.

const child_process = require("child_process");
const fs = require("fs");
const path = require("path");
const readline = require("readline");
const {ipcRenderer} = require("electron");

const log = require("./log");
const {translate} = require("./translate");
const {new_query, compare_queries, compare_moves_arrays} = require("./query");

// We don't send a query when another is running, so we must terminate
// queries by sending some non-query command. But which one?

const HALT_COMMAND = "protocol_version";

function new_gtp_engine() {

	let eng = Object.create(gtp_engine_prototype);

	eng.is_gtp = true;
	eng.has_quit = false;
	eng.exe = null;

	eng.received_version = false;					// Indicates when the engine has really started responding.
	eng.known_commands = [];
	eng.current_incoming_gtp_id = null;				// The last seen =id number from the engine e.g. =123
	eng.next_gtp_id = 1;

	eng.version_gtp_id = null;						// The GTP id for the "version" command we send.
	eng.list_commands_gtp_id = null;				// The GTP id for the "list_commands" command we send.
	
	eng.desired = null;								// The search object we want to be running.
	eng.running = null;								// The search object actually running. Possibly the same object as above.
	eng.running_info = null;						// Some extra info about the running analysis.
	eng.state = null;								// The last query actually sent to the engine. Will be the same object as .running when .running exists.

	return eng;
}

let gtp_engine_prototype = {

	__send: function(s) {							// Returns the GTP id number which was sent

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

			if (s === "version")       this.version_gtp_id       = gtp_id;
			if (s === "list_commands") this.list_commands_gtp_id = gtp_id;

		} catch (err) {
			this.shutdown();
			return null;
		}

		return gtp_id;

	},

	__send_query: function(o) {											// Returns object with some extra info about what was sent.

		if (!this.state || this.state.boardXSize !== o.boardXSize || this.state.boardYSize !== o.boardYSize) {
			if (o.boardXSize === o.boardYSize) {
				this.__send(`boardsize ${o.boardXSize}`);
			} else {
				this.__send(`rectangular_boardsize ${o.boardXSize} ${o.boardYSize}`);
			}
		}

		if (this.known_commands.includes("kata-set-rules")) {			// FIXME: if the first query is sent before the list_commands reply,
			if (!this.state || this.state.rules !== o.rules) {			// it will be saved as this.state and we will never know that the
				this.__send(`kata-set-rules ${o.rules}`);				// correct rules have not been sent...
			}
		}

		if (!this.state || this.state.komi !== o.komi) {
			this.__send(`komi ${o.komi}`);
		}

		let speedy_send = null;			// -1: Undo, 0: Nothing, 1: Advance 1			(Undo not actually implemented.)

		if (this.state) {
			if (this.state.boardXSize === o.boardXSize && this.state.boardYSize === o.boardYSize) {
				if (compare_moves_arrays(this.state.initialStones, o.initialStones)) {
					if (this.state.moves.length === o.moves.length) {
						if (compare_moves_arrays(this.state.moves, o.moves)) {
							speedy_send = 0;
						}
					} else if (this.state.moves.length === o.moves.length - 1) {
						if (compare_moves_arrays(this.state.moves, o.moves.slice(0, -1))) {
							speedy_send = 1;
						}
					}
				}
			}
		}

		if (speedy_send === 0) {
			// Engine has correct position already.
		} else if (speedy_send === 1) {
			let move = o.moves[o.moves.length - 1];
			this.__send(`play ${move[0]} ${move[1]}`);
		} else {
			this.__send("clear_board");
			for (let move of o.initialStones) {
				this.__send(`play ${move[0]} ${move[1]}`);
			}
			for (let move of o.moves) {
				this.__send(`play ${move[0]} ${move[1]}`);
			}
		}

		// Now save the state the engine is going to be in...

		this.state = o;

		// Work out what colour we're analysing...

		let colour;

		if (o.moves.length > 0) {
			let last_colour = o.moves[o.moves.length - 1][0].toLowerCase();
			if (last_colour === "w") {
				colour = "b";
			} else {
				colour = "w";
			}
		} else if (o.initialPlayer) {
			colour = o.initialPlayer.toLowerCase();
		} else {
			colour = "b";
		}

		// Send the command and return some supplimentary info we need to keep track of...

		let ownership = false;
		let command = "lz-analyze";

		if (this.known_commands.includes("kata-analyze")) {
			ownership = o.includeOwnership;
			command = "kata-analyze";
		}

		let query_id = o.id;

		let s = `${command} ${colour} ${o.reportDuringSearchEvery * 100}`;
		if (ownership) s += ` ownership true`;

		let gtp_id = this.__send(s);

		return {colour, command, query_id, gtp_id};

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
			this.__send(HALT_COMMAND);
		} else {
			this.running_info = this.__send_query(this.desired);
			this.running = this.desired;
		}
	},

	halt: function() {
		ipcRenderer.send("set_check_false", [translate("MENU_ANALYSIS"), translate("MENU_GO_HALT_TOGGLE")]);
		this.desired = null;
		this.__send(HALT_COMMAND);
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

		if (config.logfile) {
			this.log_received_string(line);
		}

		// ------------------------------------------------------------------------------------------------------------------------------------------
		// If we receive a blank line, it means some reply has finished...

		if (line === "") {
			this.handle_response_finish();
			return;														// We don't actually want to process the line.
		}

		// ------------------------------------------------------------------------------------------------------------------------------------------
		// A "?" means the command we sent was not understood...

		if (line.startsWith("?")) {
			console.log(line);
			this.current_incoming_gtp_id = null;
			return;
		}

		// ------------------------------------------------------------------------------------------------------------------------------------------
		// Good replies will start like "=123"... we have a method to fix our bookkeeping and return the useful part of the line.

		if (line.startsWith("=")) {
			line = this.handle_response_start(line);
		}

		// ------------------------------------------------------------------------------------------------------------------------------------------
		// If the currently incoming GTP id matches some important command we sent, deal with it...

		if (this.current_incoming_gtp_id && this.current_incoming_gtp_id === this.version_gtp_id) {
			this.received_version = true;
			hub.receive_object({action: "query_version"});				// The hub expects to receive this, to trigger a draw().
		}

		if (this.current_incoming_gtp_id && this.current_incoming_gtp_id === this.list_commands_gtp_id) {
			this.known_commands.push(line);
		}

		// ------------------------------------------------------------------------------------------------------------------------------------------
		// If we receive an info block, and the GTP identifier matches what we expect, deal with it...

		if (line.startsWith("info ") && this.running_info && this.running_info.gtp_id === this.current_incoming_gtp_id) {

			let analysis_object = make_analysis_object(line, this.running_info);

			if (analysis_object) {
				hub.receive_object(analysis_object);
			}
		}
	},

	handle_response_start: function(line) {				// Called when the line starts with "=" and returns the contentful part of the line.

		let id = parseInt(line.slice(1), 10);			// Relying on parseInt not caring about gibberish after the number.

		if (!Number.isNaN(id)) {
			this.current_incoming_gtp_id = id;
		}

		// Delete the GTP identifier before further processing of the line...

		let space_index = line.indexOf(" ");
		if (space_index !== -1) {
			line = line.slice(space_index + 1);
		} else {
			line = "";
		}

		return line;
	},

	handle_response_finish: function() {				// Called upon receiving a blank line indicating response ended.

		// Is a query running, and is this blank line terminating it?
		// If yes, we may need to start a new query...

		if (this.running_info && this.running_info.gtp_id === this.current_incoming_gtp_id) {

			if (this.desired === this.running) {
				this.desired = null;
				ipcRenderer.send("set_check_false", [translate("MENU_ANALYSIS"), translate("MENU_GO_HALT_TOGGLE")]);
			}

			this.running_info = null;
			this.running = null;

			if (this.desired) {
				this.running_info = this.__send_query(this.desired);
				this.running = this.desired;
			}

		}

		this.current_incoming_gtp_id = null;			// After the above.
	},

	handle_stderr: function(line) {

		if (line.includes("exception")) {
			alert("GTP engine said:\n" + line);
		}

		if (this.has_quit || this.received_version) {	// Suppress stderr for GTP, since Leela sends a ton.
			return;
		}

		log("! " + line);

		stderrbox.receive(line);
	},

	problem_text: function() {
		if (this.exe) return "";
		return `GTP engine not running.`;
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
		this.running_info = null;
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



function is_gtp_move(s) {					// Very lax, accepting A0 to Z99

	if (s.length === 2) {
		return (
			s.charCodeAt(0) >= 65 &&		// A
			s.charCodeAt(0) <= 90 &&		// Z
			s.charCodeAt(1) >= 48 &&		// 0
			s.charCodeAt(1) <= 57);			// 9
	}

	if (s.length === 3) {
		return (
			s.charCodeAt(0) >= 65 &&
			s.charCodeAt(0) <= 90 &&
			s.charCodeAt(1) >= 48 &&
			s.charCodeAt(1) <= 57 &&
			s.charCodeAt(2) >= 48 &&
			s.charCodeAt(2) <= 57);
	}

	return false;
}



function make_analysis_object(line, running_info) {

	let kata = (running_info.command === "kata-analyze");

	let o = {
		id: running_info.query_id,
		moveInfos: [],
		ownership: [],
		rootInfo: {
			visits: 0,
			winrate: 0.5,
		},
	};

	let info_blocks = line.split("info ");

	for (let block of info_blocks) {

		// Each block contains all the info needed to make a moveInfo object.

		if (block === "") {
			continue;
		}

		let tokens = block.split(" ");

		let moveinfo = {		// Should maybe add null default values?
			pv: [],
		};

		let parsing = null;

		for (let token of tokens) {

			if (token === "") {
				continue;
			}

			if (["move", "visits", "winrate", "prior", "scoreLead", "lcb", "order", "pv", "ownership"].includes(token)) {
				parsing = token;
				continue;
			}

			// Easy stuff...

			if (parsing === "move") {
				if (is_gtp_move(token)) {
					moveinfo.move = token;
				}
				parsing = null;
			}

			if (parsing === "order") {
				moveinfo.order = parseInt(token, 10);
				parsing = null;
			}

			if (parsing === "pv") {
				if (is_gtp_move(token)) {
					moveinfo.pv.push(token);
					// stay in parsing state "pv"
				} else {
					parsing = null;
				}
			}

			// The ownership map is likely present at the end of the line, meaning we will encounter
			// it during our parse of the final block. But it's not really part of that block.

			if (parsing === "ownership") {
				let val = parseFloat(token);
				if (!Number.isNaN(val)) {
					if (running_info.colour === "w") {				// Flip so we always store B's POV
						val *= -1;
					}
					o.ownership.push(val);
					// stay in parsing state "ownership"
				} else {
					parsing = null;
				}
			}

			// Harder stuff...

			if (parsing === "winrate") {
				if (kata) {
					moveinfo.winrate = parseFloat(token);
				} else {
					moveinfo.winrate = parseInt(token, 10) / 10000;
				}
				if (running_info.colour === "w") {					// Flip so we always store B's POV
					moveinfo.winrate = 1 - moveinfo.winrate;
				}
				parsing = null;
			}

			if (parsing === "lcb") {
				if (kata) {
					moveinfo.lcb = parseFloat(token);
				} else {
					moveinfo.lcb = parseInt(token, 10) / 10000;
				}
				if (running_info.colour === "w") {					// Flip so we always store B's POV
					moveinfo.lcb = 1 - moveinfo.lcb;
				}
				parsing = null;
			}

			if (parsing === "scoreLead") {
				moveinfo.scoreLead = parseFloat(token);
				if (running_info.colour === "w") {					// Flip so we always store B's POV
					moveinfo.scoreLead *= -1;
				}
				parsing = null;
			}

			if (parsing === "prior") {
				if (kata) {
					moveinfo.prior = parseFloat(token);
				} else {
					moveinfo.prior = parseInt(token, 10) / 10000;
				}
				parsing = null;
			}

			if (parsing === "visits") {
				moveinfo.visits = parseInt(token, 10);
				o.rootInfo.visits += moveinfo.visits;
				parsing = null;
			}
		}

		if (moveinfo.pv.length > 0) {
			o.moveInfos.push(moveinfo);
		}

	}

	if (o.moveInfos.length > 0) {
		if (o.ownership.length === 0) {
			delete o.ownership;
		}
		o.rootInfo.winrate = o.moveInfos[0].winrate;
		if (typeof o.moveInfos[0].scoreLead === "number") {
			o.rootInfo.scoreLead = o.moveInfos[0].scoreLead;
		}
		return o;
	} else {
		return null;
	}
}



module.exports = new_gtp_engine;
