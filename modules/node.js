"use strict";

const NewBoard = require("./board").NewBoard;
const stringify = require("./stringify");

exports.NewNode = function(parent) {

	let node = Object.create(node_prototype);

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

	get_board: function() {

		if (this.board) {
			return this.board;
		}

		if (!this.parent) {
			this.board = NewBoard(19, 19);		// FIXME
			return this.board;
		}

		this.board = this.parent.get_board().copy();

		// FIXME - add AB, AW, AE

		let bmove = this.get("B");
		if (typeof bmove === "string") {
			this.board.play_black(bmove);
		}

		let wmove = this.get("W");
		if (typeof wmove === "string") {
			this.board.play_white(wmove);
		}

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

		let node = exports.NewNode(this);
		node.set(propkey, s);

		return node;
	},

};
