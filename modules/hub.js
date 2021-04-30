"use strict";

const fs = require("fs");

const NewBoardDrawer = require("./new_board_drawer");
const NewNode = require("./new_node");
const LoadSGF = require("./load_sgf");

// ---------------------------------------------------------------------

exports.NewHub = function() {

	let hub = Object.create(null);

	hub.node = NewNode();

	hub.maindrawer = NewBoardDrawer(
		document.getElementById("boardbg"),
		document.getElementById("boardtable")
	);

	Object.assign(hub, hub_props);
	return hub;
};

// ---------------------------------------------------------------------

let hub_props = {

	draw: function() {
		this.maindrawer.Draw(this.node);
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
			this.set_node(LoadSGF(s, 0, null).root);
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
};
