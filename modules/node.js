"use strict";

const new_board = require("./board");
const stringify = require("./stringify");

let next_node_id = 1;
let next_query_id = 1;

function new_node(parent) {

	let node = Object.create(node_prototype);

	node.id = `node_${next_node_id++}`;
	node.parent = parent;
	node.children = [];
	node.props = Object.create(null);
	node.analysis = null;
	node.__board = null;

	if (parent) {
		parent.children.push(node);
	}

	return node;
};

let node_prototype = {

	set: function(key, value) {
		if (this.__board) {
			throw "set() called on node but board already existed";
		}
		this.props[key] = [stringify(value)];
	},

	add_value: function(key, value) {
		if (this.__board) {
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
		if (this.__board) {
			return this.__board.width;
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
		if (this.__board) {
			return this.__board.height;
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

	node_history_reversed: function() {
		let ret = [this];
		let node = this;
		while (node.parent) {
			node = node.parent;
			ret.push(node);
		}
		return ret;
	},

	get_board: function() {

		if (this.__board) {
			return this.__board;
		}

		if (!this.parent) {
			this.__board = new_board(this.width(), this.height());
		} else {
			this.__board = this.parent.get_board().copy();
		}

		for (let s of this.all_values("AE")) {
			this.__board.add_empty(s);
		}

		for (let s of this.all_values("AB")) {
			this.__board.add_black(s);
			this.__board.active = "w";
		}

		for (let s of this.all_values("AW")) {
			this.__board.add_white(s);
			this.__board.active = "b";
		}

		for (let s of this.all_values("B")) {
			this.__board.play_black(s);
		}

		for (let s of this.all_values("W")) {
			this.__board.play_white(s);
		}

		let pl = this.get("PL");
		if (pl === "B" || pl === "b") this.__board.active = "b";
		if (pl === "W" || pl === "w") this.__board.active = "w";

		let km = parseFloat(this.get("KM"));
		if (Number.isNaN(km) === false) {
			this.__board.komi = km;
		}

		return this.__board;
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

		let setup = [];
		let moves = [];

		let history_reversed = this.node_history_reversed();

		for (let node of history_reversed) {

			if (node.props.AB || node.props.AW || node.props.AE) {

				// In this case, our final object will have only moves after
				// this node, but will set up the position at this node.

				setup = node.get_board().setup_list();
				break;
			}

			if (node.props.B || node.props.W) {

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

		moves.reverse();

		o.id = `${this.id}:${next_query_id++}`;
		if (setup.length > 0) {
			o.initialStones = setup;
		}
		o.moves = moves;
		o.rules = "aga";
		o.komi = this.get_board().komi;
		o.boardXSize = this.width();
		o.boardYSize = this.height();
		o.maxVisits = 1000000;
		o.reportDuringSearchEvery = 0.4;
		o.overrideSettings = {
			reportAnalysisWinratesAs: "SIDETOMOVE"
		};

		return o;
	},

};



module.exports = new_node;
