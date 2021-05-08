"use strict";

const fs = require("fs");
const {ipcRenderer} = require("electron");

const new_board_drawer = require("./board_drawer");
const new_engine = require("./engine");
const new_grapher = require("./grapher");
const new_node = require("./node");
const load_gib = require("./load_gib");
const load_ngf = require("./load_ngf");
const load_sgf = require("./load_sgf");
const save_sgf = require("./save_sgf");
const {defaults} = require("./config_io");
const {get_title, set_title} = require("./title");
const {handicap_stones, node_id_from_search_id, xy_to_s} = require("./utils");

// ---------------------------------------------------------------------

exports.new_hub = function() {

	let hub = Object.create(hub_prototype);

	hub.maindrawer = new_board_drawer(
		document.getElementById("boardbg"),
		document.getElementById("boardtable"),
		document.getElementById("boardcanvas"),
		document.getElementById("boardinfo")
	);

	hub.grapher = new_grapher(
		document.getElementById("graphcanvas"),
		document.getElementById("graphpositioncanvas")
	);

	hub.engine = new_engine();
	hub.engine.setup(config.engine, config.engineconfig, config.weights);

	hub.__autoanalysis = false;			// Don't set this directly, because it should be ack'd
	hub.__autoplay = false;				// Don't set this directly, because it should be ack'd
	hub.window_resize_time = null;
	hub.loaded_file = null;

	hub.new_from_config();

	hub.update_title();
	return hub;
};

// ---------------------------------------------------------------------

let hub_prototype = {

	draw: function() {

		let did_draw_pv = false;

		let s = this.mouse_point();

		if (s) {
			did_draw_pv = this.maindrawer.draw_pv(this.node, s);
		}

		if (!did_draw_pv) {
			this.maindrawer.draw_standard(this.node);
		}
	},

	mouseenter: function(s) {											// Mouse has entered some point e.g. "jj"
		let did_draw_pv = this.maindrawer.draw_pv(this.node, s);
		if (!did_draw_pv && this.maindrawer.last_draw_was_pv) {			// Our last draw was some other point...
			this.maindrawer.draw_standard(this.node);
		}
	},

	mouse_left_board: function() {
		if (this.maindrawer.last_draw_was_pv) {
			this.maindrawer.draw_standard(this.node);
		}
	},

	try_move: function(s) {
		let node = this.node.try_move(s);
		this.set_node(node);
	},

	set_node: function(node, new_game_flag) {
		if (!node || this.node === node) {
			return;
		}
		this.node = node;
		this.draw();
		if (new_game_flag) {
			this.grapher.draw_graph(this.node);
		} else {
			this.grapher.draw_position(this.node);
		}
		if (this.engine.desired) {
			this.go();
		}
	},

	prev: function() {
		this.set_node(this.node.parent);			// OK if undefined / null
	},

	next: function() {
		this.set_node(this.node.children[0]);		// OK if undefined / null
	},

	save: function(filepath) {
		save_sgf(this.node, filepath);
	},

	load: function(filepath) {
		try {
			let buf = fs.readFileSync(filepath);
			let type = "sgf";
			if (filepath.toLowerCase().endsWith(".ngf")) type = "ngf";
			if (filepath.toLowerCase().endsWith(".gib")) type = "gib";
			if (this.load_buffer(buf, type)) {
				this.loaded_file = filepath;
			}
		} catch (err) {
			alert("While opening file:\n" + err.toString());
		}
	},

	load_sgf_from_string: function (s) {
		if (typeof s === "string") {
			let buf = Buffer.from(s);
			if (this.load_buffer(buf, "sgf")) {
				this.loaded_file = null;
			}
		}
	},

	load_buffer: function(buf, type) {
		try {
			let new_root;
			if (type === "sgf") {
				new_root = load_sgf(buf);
			} else if (type === "ngf") {
				new_root = load_ngf(buf);
			} else if (type === "gib") {
				new_root = load_gib(buf);
			} else {
				throw "unknown type";
			}
			// Any fixes to the root etc should be done now, before set_node causes a board to exist.
			this.set_node(new_root, true);
			this.update_title();
			return true;
		} catch (err) {
			alert("While parsing buffer:\n" + err.toString());
			return false;
		}
	},

	new_from_config: function() {
		this.new(config.next_size, config.next_size, config.next_komi, config.next_handicap);
	},

	new: function(width = 19, height = 19, komi = 0, handicap = 0) {

		if (this.node) {
			this.node.destroy_tree();
		}

		let node = new_node();

		if (width === height) {
			node.set("SZ", width);
		} else {
			node.set("SZ", `${width}:${height}`);
		}

		let points = handicap_stones(handicap, width, height, false);
		for (let point of points) {
			node.add_value("AB", point);
		}

		node.set("KM", komi);

		this.set_node(node, true);
		this.update_title();
	},

	go_to_end: function() {
		let node = this.node;
		while (node.children.length > 0) {
			node = node.children[0];
		}
		this.set_node(node);
	},

	go_to_root: function() {
		let node = this.node;
		while (node.parent) {
			node = node.parent;
		}
		this.set_node(node);
	},

	return_to_main: function() {
		this.set_node(this.node.return_to_main_line_helper());
	},

	prev_sibling: function() {

		if (!this.node.parent || this.node.parent.children.length < 2) {
			return;
		}

		let previ = 0;
		for (let i = 0; i < this.node.parent.children.length; i++) {
			if (this.node.parent.children[i] === this.node) {
				previ = i - 1;
				if (previ < 0) {
					previ = this.node.parent.children.length - 1;
				}
				break;
			}
		}

		this.set_node(this.node.parent.children[previ]);
	},

	next_sibling: function() {

		if (!this.node.parent || this.node.parent.children.length < 2) {
			return;
		}

		let nexti = 0;
		for (let i = 0; i < this.node.parent.children.length; i++) {
			if (this.node.parent.children[i] === this.node) {
				nexti = i + 1;
				if (nexti >= this.node.parent.children.length) {
					nexti = 0;
				}
				break;
			}
		}

		this.set_node(this.node.parent.children[nexti]);
	},

	delete_node: function() {
		if (this.node.parent) {
			this.set_node(this.node.detach());
		} else {
			if (this.node.children.length > 0) {
				for (let child of this.node.children) {
					child.detach();
				}
				this.draw();				// Clear the next move markers.
			}
		}
	},

	promote_to_main_line: function() {

		let node = this.node;
		let changed = false;				// We might use this at some point.

		while (node.parent) {
			if (node.parent.children[0] !== node) {
				for (let n = 1; n < node.parent.children.length; n++) {
					if (node.parent.children[n] === node) {
						node.parent.children[n] = node.parent.children[0];
						node.parent.children[0] = node;
						changed = true;
						break;
					}
				}
			}
			node = node.parent;
		}
	},

	delete_other_lines: function() {

		this.promote_to_main_line();

		let node = this.node.get_root();
		let changed = false;

		while (node.children.length > 0) {
			for (let child of node.children.slice(1)) {
				child.detach();
				changed = true;
			}
			node = node.children[0];
		}

		if (changed) {
			this.draw();
		}
	},

	coerce_komi: function(value) {
		config.next_komi = value;		// For the next new game. No immediate effect.
		save_config();
		this.node.coerce_komi(value);
		this.draw();
		if (this.engine.desired) {
			this.go();
		}
	},

	go: function() {
		this.engine.analyse(this.node);
	},

	halt: function() {
		this.set_autoanalysis(false);
		this.set_autoplay(false);
		this.engine.halt();
	},

	toggle_ponder: function() {
		if (this.engine.desired) {
			this.halt();
		} else {
			this.go();
		}
	},

	set_autoanalysis: function(val) {
		this.__autoanalysis = val ? true : false;
		ipcRenderer.send("ack_autoanalysis", this.__autoanalysis);
	},

	set_autoplay: function(val) {
		this.__autoplay = val ? true : false;
		ipcRenderer.send("ack_autoplay", this.__autoplay);
	},

	start_autoanalysis() {
		this.set_autoanalysis(true);
		this.set_autoplay(false);
		if (!this.engine.desired) {
			this.go();
		}
	},

	start_autoplay: function() {
		this.set_autoanalysis(false);
		this.set_autoplay(true);
		if (!this.engine.desired) {
			this.go();
		}
	},

	play_best: function() {
		if (this.node.has_valid_analysis()) {
			let s = this.node.get_board().parse_gtp_move(this.node.analysis.moveInfos[0].move);
			if (!s) {
				this.pass();
			} else {
				let node = this.node.force_move(s);
				this.set_node(node);
			}
		}
	},

	pass: function() {
		let node = this.node.pass();
		this.set_node(node);
	},

	handle_drop: function(event) {
		if (event.dataTransfer && event.dataTransfer.files && event.dataTransfer.files[0] && event.dataTransfer.files[0].path) {
			this.load(event.dataTransfer.files[0].path);
		}
	},

	save_window_size: function() {
		config.width = window.innerWidth;
		config.height = window.innerHeight;
		save_config();
	},

	display_props: function(rootflag) {
		let props = rootflag ? this.node.get_root().props : this.node.props;
		let lines = [];
		for (let key of Object.keys(props)) {
			lines.push(`${key}: [${props[key].join("][")}]`);
		}
		alert(lines.join("\n"));
	},

	forget_analysis_tree: function() {
		this.node.forget_analysis_tree();
		this.halt();
		this.draw();
	},

	throw_exception: function() {
		throw "test exception";
	},

	receive_object: function(o) {

		if (typeof o !== "object" || o === null) {
			return;
		}

		let relevant_node_id = node_id_from_search_id(o.id);

		if (relevant_node_id === this.node.id) {

			this.node.receive_analysis(o);			// This does all needed validation of o

			if (this.__autoanalysis && o.rootInfo && o.rootInfo.visits > config.autoanalysis_visits) {

				if (this.node.children.length > 0) {
					this.next();
					return;							// Just to avoid the redundant draw()
				} else {
					this.halt();
				}

			} else if (this.__autoplay && o.rootInfo && o.rootInfo.visits > config.autoanalysis_visits) {

				this.play_best();					// Giving us a new node, which we now check for being the 2nd pass...

				if (this.node.parent && this.node.parent.has_pass() && this.node.has_pass()) {
					this.halt();
				}

				return;								// Just to avoid the redundant draw()
			}

			this.draw();

		} else if (this.node.parent && relevant_node_id === this.node.parent.id) {					// A common event when auto-analysing.

			this.node.parent.receive_analysis(o);

		}
	},

	reset_colours: function() {
		for (let key of Object.keys(defaults)) {
			if (typeof defaults[key] === "string" && defaults[key].startsWith("#")) {
				config[key] = defaults[key];
			}
		}
		save_config();
		this.draw();
	},

	mouse_point: function() {
		let overlist = document.querySelectorAll(":hover");
		for (let item of overlist) {
			if (typeof item.className === "string") {
				let classes = item.className.split(" ");
				for (let c of classes) {
					if (c.startsWith("td_")) {
						return c.slice(3);
					}
				}
			}
		}
		return null;
	},

	graph_click: function(event) {
		let node = this.grapher.node_from_click(this.node, event);
		this.set_node(node);
	},

	window_resize_checker: function() {
		if (this.window_resize_time) {
			this.save_window_size();
			this.window_resize_time = null;
		}
		setTimeout(() => {
			this.window_resize_checker();
		}, 1000);
	},

	graph_draw_spinner: function() {
		this.grapher.draw_graph(this.node);
		setTimeout(() => {
			this.graph_draw_spinner();
		}, Math.max(50, config.graph_draw_delay));
	},

	set_engine: function(filepath) {
		config.engine = filepath;
		save_config();
		this.maybe_start_engine();
	},

	set_engineconfig: function(filepath) {
		config.engineconfig = filepath;
		save_config();
		this.maybe_start_engine();
	},

	set_weights: function(filepath) {
		config.weights = filepath;
		save_config();
		this.maybe_start_engine();
	},

	maybe_start_engine: function() {

		if (this.engine.exe) {
			alert("A restart is required for the new settings.");
			return;
		}

		this.engine.setup(config.engine, config.engineconfig, config.weights);
		this.update_title();
	},

	update_title: function() {

		if (this.engine.problem_text()) {
			set_title(`Ogatak: ${this.engine.problem_text()}`);
			return;
		}

		let root = this.node.get_root();

		if (root.props.PB || root.props.PW) {
			let blackname = root.get("PB") || "Unknown";
			let whitename = root.get("PW") || "Unknown";
			set_title(`${blackname} (B) vs ${whitename} (W)`);
			return;
		}

		set_title("Ogatak");
	},

};
