"use strict";

const new_board = require("./new_board");
const stringify = require("./stringify");

let next_node_id = 1;
let next_query_id = 1;

function new_node(parent) {

	let node = Object.create(node_prototype);

	node.id = next_node_id++;
	node.parent = parent;
	node.children = [];
	node.props = Object.create(null);
	node.board = null;

	if (parent) {
		parent.children.push(node);
	}

	return node;
};

let node_prototype = {

	set: function(key, value) {
		if (this.board) {
			throw "set() called on node but board already existed";
		}
		this.props[key] = [stringify(value)];
	},

	add_value: function(key, value) {
		if (this.board) {
			throw "add_value() called on node but board already existed";
		}
		if (!this.props[key]) {
			this.props[key] = [];
		}
		this.props[key].push(stringify(value));
	},

	get: function(key) {				// On the assumption there is only 1 value for this key.
		if (!this.props[key]) {
			return undefined;
		}
		return this.props[key][0];
	},

	all_values: function(key) {
		let ret = [];
		if (!this.props[key]) {
			return ret;
		}
		for (let value of this.props[key]) {
			ret.push(value);
		}
		return ret;
	},

	get_root: function() {
		let node = this;
		while (node.parent) {
			node = node.parent;
		}
		return node;
	},

	width: function() {
		if (this.board) {
			return this.board.width;
		}
		let sz_prop = this.get_root().get("SZ");
		if (!sz_prop) {
			return 19;
		}
		let sz = parseInt(sz_prop, 10);
		if (Number.isNaN(sz) === false && sz > 0 && sz <= 25) {
			return sz;
		}
		return 19;
	},

	height: function() {
		if (this.board) {
			return this.board.height;
		}
		let sz_prop = this.get_root().get("SZ");
		if (!sz_prop) {
			return 19;
		}
		let sz_slice;
		if (sz_prop.includes(":")) {
			sz_slice = sz_prop.slice(sz_prop.indexOf(":") + 1);
		} else {
			sz_slice = sz_prop;
		}
		let sz = parseInt(sz_slice, 10);
		if (Number.isNaN(sz) === false && sz > 0 && sz <= 25) {
			return sz;
		}
		return 19;
	},

	get_board: function() {

		if (this.board) {
			return this.board;
		}

		if (!this.parent) {
			this.board = new_board(this.width(), this.height());		// FIXME
		} else {
			this.board = this.parent.get_board().copy();
		}

		for (let s of this.all_values("AE")) {
			this.board.add_empty(s);
		}

		for (let s of this.all_values("AB")) {
			this.board.add_black(s);
			this.board.active = "w";
		}

		for (let s of this.all_values("AW")) {
			this.board.add_white(s);
			this.board.active = "b";
		}

		for (let s of this.all_values("B")) {
			this.board.play_black(s);
		}

		for (let s of this.all_values("W")) {
			this.board.play_white(s);
		}

		let pl = this.get("PL");
		if (pl === "B" || pl === "b") this.board.active = "b";
		if (pl === "W" || pl === "w") this.board.active = "w";

		return this.board;
	},

	try_move: function(s) {

		let board = this.get_board();

		if (board.legal(s) === false) {
			return this;
		}

		let propkey = board.active.toUpperCase();

		for (let child of this.children) {
			if (child.get(propkey) === s) {
				return child;
			}
		}

		let node = new_node(this);
		node.set(propkey, s);

		return node;
	},

	return_to_main_line_helper: function() {

		// Returns the node that "return to main line" should go to.

		let ret = this;
		let node = this;

		while (node.parent) {
			if (node.parent.children[0] !== node) {
				ret = node.parent;
			}
			node = node.parent;
		}

		return ret;
	},

	katago_query: function() {

		let o = {};

		o.id = `${next_query_id++}_${next_node_id++}`;
		o.initialStones = [];
		o.moves = [];
		o.rules = "aga";

		// TODO

	},

};



module.exports = new_node;
