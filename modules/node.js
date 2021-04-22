"use strict";

const NewBoard = require("./board").NewBoard;

exports.NewNode = function(parent) {

	let node = Object.create(node_prototype);

	node.parent = parent;
	node.props = Object.create(null);
	node.board = null;

	return node;
};

let node_prototype = {

	set: function(key, value) {
		this.props[key] = [value];
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

		let bmove = this.get("B");
		if (bmove) {
			this.board.play_black(bmove);
		}

		let wmove = this.get("W");
		if (wmove) {
			this.board.play_white(wmove);
		}

		return this.board;
	},

	try_move: function(s) {

		let board = this.get_board();

		if (board.legal(s) === false) {
			return this;
		}

		let node = exports.NewNode(this);

		if (board.active === "b") {
			node.set("B", s);
		} else {
			node.set("W", s);
		}

		return node;

	},

};
