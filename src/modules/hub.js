"use strict";

const fs = require("fs");

const new_board_drawer = require("./board_drawer");
const new_engine = require("./engine");
const new_node = require("./node");
const load_gib = require("./load_gib");
const load_ngf = require("./load_ngf");
const load_sgf = require("./load_sgf");

const {get_title, set_title} = require("./title");
const {handicap_stones, node_id_from_search_id, xy_to_s} = require("./utils");

// ---------------------------------------------------------------------

exports.new_hub = function() {

	let hub = Object.create(null);

	hub.maindrawer = new_board_drawer(
		document.getElementById("boardbg"),
		document.getElementById("boardtable"),
		document.getElementById("boardcanvas"),
		document.getElementById("boardinfo")
	);

	hub.engine = new_engine();
	hub.engine.setup(config.engine, config.engineconfig, config.weights);

	Object.assign(hub, hub_props);

	hub.new();
	return hub;
};

// ---------------------------------------------------------------------

let hub_props = {

	draw: function() {
		this.maindrawer.draw_board(this.node);
		this.maindrawer.draw_canvas(this.node);
		this.maindrawer.draw_info(this.node, this.engine);
	},

	try_move: function(s) {
		let node = this.node.try_move(s);
		this.set_node(node);
	},

	set_node: function(node) {
		if (!node || this.node === node) {
			return;
		}
		this.node = node;
		this.draw();
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

	load: function(filepath) {
		try {
			let buf = fs.readFileSync(filepath);
			let type = "sgf";
			if (filepath.toLowerCase().endsWith(".ngf")) type = "ngf";
			if (filepath.toLowerCase().endsWith(".gib")) type = "gib";
			this.load_buffer(buf, type);
		} catch (err) {
			alert("While opening file:\n" + err.toString());
		}
	},

	load_sgf_from_string: function (s) {
		if (typeof s === "string") {
			let buf = Buffer.from(s);
			this.load_buffer(buf, "sgf");
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
			this.set_node(new_root);
			if (this.node.props.PB || this.node.props.PW) {
				let blackname = this.node.get("PB") || "Unknown";
				let whitename = this.node.get("PW") || "Unknown";
				set_title(`${blackname} (B) vs ${whitename} (W)`);
			} else {
				set_title("Ogatak");
			}
		} catch (err) {
			alert("While parsing buffer:\n" + err.toString());
		}
	},

	new: function() {

		let width = config.next_size || 19;
		let height = config.next_size || 19;
		let komi = config.next_komi || 0;
		let handicap = config.next_handicap || 0;

		if (this.node) {
			this.node.destroy_tree();
		}

		let node = new_node();

		if (width === height) {			// Currently always so...
			node.set("SZ", width);
		} else {
			node.set("SZ", `${width}:${height}`);
		}

		let points = handicap_stones(handicap, width, height, false);
		for (let point of points) {
			node.add_value("AB", point);
		}

		node.set("KM", komi);

		this.set_node(node);
		set_title("Ogatak");
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
			}
		}
	},

	promote_to_main_line: function() {

		let node = this.node;
		let changed = false;		// We might use this at some point.

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

	coerce_komi: function(value) {
		this.node.coerce_komi(value);
		this.maindrawer.draw_info(this.node, this.engine);
		if (this.engine.desired) {
			this.go();
		}
	},

	set_rules: function(value) {
		config.rules = value;
		save_config();
		if (this.engine.desired) {
			this.go();
		}
	},

	go: function() {
		this.engine.analyse(this.node);
	},

	halt: function() {
		this.engine.halt();
	},

	play_best: function() {
		if (this.node.analysis && Array.isArray(this.node.analysis.moveInfos) && this.node.analysis.moveInfos.length > 0) {
			let [x, y] = this.node.get_board().parse_gtp_move(this.node.analysis.moveInfos[0].move);
			if (x === -1 || y === -1) {
				// todo handle pass;
			} else {
				let node = this.node.force_move(xy_to_s(x, y));
				this.set_node(node);
			}
		}
	},

	handle_drop: function(event) {
		if (event.dataTransfer && event.dataTransfer.files && event.dataTransfer.files[0] && event.dataTransfer.files[0].path) {
			this.load(event.dataTransfer.files[0].path);
		}
	},

	display_props: function(rootflag) {
		let props = rootflag ? this.node.get_root().props : this.node.props;
		let lines = [];
		for (let key of Object.keys(props)) {
			lines.push(`${key}: [${props[key].join("][")}]`);
		}
		alert(lines.join("\n"));
	},

	forget_analysis: function() {
		this.node.analysis = null;
		this.engine.suppress();
		this.halt();
		this.draw();
	},

	receive_object: function(o) {
		if (node_id_from_search_id(o.id) === this.node.id) {
			this.node.analysis = o;
			this.maindrawer.draw_canvas(this.node);
		}
		this.maindrawer.draw_info(this.node, this.engine);		// To update the "running" string.
	},
};
