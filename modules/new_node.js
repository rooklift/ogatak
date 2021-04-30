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

	node_history: function() {
		let ret = [this];
		let node = this;
		while (node.parent) {
			node = node.parent;
			ret.push(node);
		}
		ret.reverse();
		return ret;
	},

	get_board: function() {

		if (this.board) {
			return this.board;
		}

		if (!this.parent) {
			this.board = new_board(this.width(), this.height());
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

		let initial = [];
		let moves = [];

		let node_history = this.node_history();

		let have_seen_play = false;

		for (let node of node_history) {

			if (node.props.AE) {
				return this.katago_simple_query();
			}

			if (node.props.AB || node.props.AW) {
				if (have_seen_play) {
					return this.katago_simple_query();
				}
				for (let s of node.all_values("AB")) {
					if (node.get_board().in_bounds(s)) {
						initial.push(["B", node.get_board().gtp(s)]);
					}
				}
				for (let s of node.all_values("AW")) {
					if (node.get_board().in_bounds(s)) {
						initial.push(["W", node.get_board().gtp(s)]);
					}
				}
			}

			if (node.props.B || node.props.W) {		// There's an argument for doing this before the above, but...
				have_seen_play = true;
				for (let s of node.all_values("B")) {
					if (node.get_board().in_bounds(s)) {
						moves.push(["B", node.get_board().gtp(s)]);
					}
				}
				for (let s of node.all_values("W")) {
					if (node.get_board().in_bounds(s)) {
						moves.push(["W", node.get_board().gtp(s)]);
					}
				}
			}
		}

		o.id = `${next_query_id++}_${this.id}`;
		if (initial.length > 0) {
			o.initialStones = initial;
		}
		o.moves = moves;
		o.rules = "aga";
		o.boardXSize = this.width();
		o.boardYSize = this.height();

		return JSON.stringify(o);
	},

	katago_simple_query: function() {
		throw "todo";
	},

};



module.exports = new_node;
