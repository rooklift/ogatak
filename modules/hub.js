"use strict";

const fs = require("fs");

const new_board_drawer = require("./new_board_drawer");
const new_engine = require("./new_engine");
const new_node = require("./new_node");
const load_sgf = require("./load_sgf");

const {node_id_from_search_id} = require("./utils");

// ---------------------------------------------------------------------

exports.new_hub = function() {

	let hub = Object.create(null);

	hub.node = new_node();

	hub.maindrawer = new_board_drawer(
		document.getElementById("boardbg"),
		document.getElementById("boardtable"),
		document.getElementById("boardcanvas"),
	);

	hub.engine = new_engine();
	hub.engine.setup(config.engine, config.engineconfig, config.weights);

	Object.assign(hub, hub_props);
	return hub;
};

// ---------------------------------------------------------------------

let hub_props = {

	draw: function() {
		this.maindrawer.drawboard(this.node);
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
		this.maindrawer.drawboard(this.node);
		this.maindrawer.clear_canvas();
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
			let s = fs.readFileSync(filepath);
			this.set_node(load_sgf(s, 0, null).root);
		} catch (err) {
			console.log(err.toString());
		}
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

	go: function() {
		this.engine.analyse(this.node);
	},

	halt: function() {
		this.engine.halt();
	},

	receive_object: function(o) {
		if (node_id_from_search_id(o.id) === this.node.id) {
			this.maindrawer.drawobject(o);
		}
	},
};
