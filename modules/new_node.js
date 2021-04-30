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
		this.props[key] = [stringify(value)];
	},

	add_value: function(key, value) {
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
		let sz = parseInt(this.get_root().get("SZ"), 10);
		if (Number.isNaN(sz) === false && sz > 0 && sz <= 25) {
			return sz;
		}
		return 19;
	},

	height: function() {
		if (this.board) {
			return this.board.height;
		}
		let sz = parseInt(this.get_root().get("SZ"), 10);
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

		if (this.props.AE) {
			for (let s of this.props.AE) {
				this.board.add_empty(s);
			}
		}

		if (this.props.AB) {
			for (let s of this.props.AB) {
				this.board.add_black(s);
			}
			this.board.active = "w";
		}

		if (this.props.AW) {
			for (let s of this.props.AW) {
				this.board.add_white(s);
			}
			this.board.active = "b";
		}

		let bmove = this.get("B");
		if (typeof bmove === "string") {
			this.board.play_black(bmove);
		}

		let wmove = this.get("W");
		if (typeof wmove === "string") {
			this.board.play_white(wmove);
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
