"use strict";

const new_board = require("./board");
const stringify = require("./stringify");
const {replace_all} = require("./utils");

let next_node_id = 1;
let next_query_id = 1;

// ------------------------------------------------------------------------------------------------

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
		node.graph_length_knower = parent.graph_length_knower;		// 1 object every node points to, a bit lame
		node.depth = parent.depth + 1;
	} else {
		node.graph_length_knower = {val: 60};
		node.depth = 0;
	}

	if (node.depth + 1 > node.graph_length_knower.val) {
		node.graph_length_knower.val = node.depth + 1;
	}

	return node;
}

// ------------------------------------------------------------------------------------------------

let node_prototype = {

	set: function(key, value) {
		if (this.__board) {
			throw "set() called on node but board already existed";
		}
		this.props[key] = [stringify(value)];
	},

	force_set: function(key, value) {
		this.props[key] = [stringify(value)];
	},

	add_value: function(key, value) {
		if (this.__board) {
			throw "add_value() called on node but board already existed";
		}
		if (!this.props[key]) {
			this.props[key] = [];
		}

		// Specially deal with wrong komi format...

		if (key === "KM") {
			if (typeof value === "string") {
				value = parseFloat(value);
			}
			if (value - Math.floor(value) === 0.75 || value - Math.floor(value) === 0.25) {
				value *= 2;
			}
		}

		this.props[key].push(stringify(value));
	},

	get: function(key) {				// On the assumption there is only 1 value for this key.
		if (!this.props[key]) {
			return undefined;
		}
		return this.props[key][0];
	},

	force_delete_key: function(key) {	// Remember not to use this if changing the key mutates the board.
		delete this.props[key];
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

	get_end: function() {
		let node = this;
		while (node.children.length > 0) {
			node = node.children[0];
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

	history_reversed: function() {
		let ret = [this];
		let node = this;
		while (node.parent) {
			node = node.parent;
			ret.push(node);
		}
		return ret;
	},

	history: function() {
		return this.history_reversed().reverse();
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
			this.__board.play_black(s);				// Will treat s as a pass if it's not a valid move.
		}

		for (let s of this.all_values("W")) {
			this.__board.play_white(s);				// Will treat s as a pass if it's not a valid move.
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

	try_move: function(s) {							// Note: not to be used for passing.
		let board = this.get_board();
		if (board.legalmove(s) === false) {
			return this;
		}
		return this.force_move(s);
	},

	force_move: function(s) {						// Note: not to be used for passing.

		let board = this.get_board();
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

	pass: function() {

		let board = this.get_board();
		let propkey = board.active.toUpperCase();

		for (let child of this.children) {
			if (child.props[propkey]) {									// The child has a B/W property...
				if (board.in_bounds(child.get(propkey)) === false) {	// And it is not a real move...
					return child;
				}
			}
		}

		let node = new_node(this);
		node.set(propkey, "");

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
		o.overrideSettings = {};

		let setup = [];
		let moves = [];

		for (let node of this.history_reversed()) {

			if (node.props.AB || node.props.AW || node.props.AE) {

				// In this case, our final object will have only moves after
				// this node, but will set up the position at this node.

				setup = node.get_board().setup_list();
				break;
			}

			if (node.props.B || node.props.W) {

				for (let s of node.all_values("B")) {
					moves.push(["B", node.get_board().gtp(s)]);		// Sends "pass" if s is not in-bounds;
				}

				for (let s of node.all_values("W")) {
					moves.push(["W", node.get_board().gtp(s)]);		// Sends "pass" if s is not in-bounds;
				}
			}
		}

		moves.reverse();

		o.id = `${this.id}:${next_query_id++}`;
		if (setup.length > 0) {
			o.initialStones = setup;
		}
		o.moves = moves;
		if (moves.length === 0) {
			o.initialPlayer = this.get_board().active.toUpperCase();
		}
		o.rules = config.rules;
		o.komi = this.get_board().komi;
		o.boardXSize = this.width();
		o.boardYSize = this.height();
		o.maxVisits = 1000000;
		o.reportDuringSearchEvery = 0.1;
		o.overrideSettings.reportAnalysisWinratesAs = "SIDETOMOVE";
		if (config.widerootnoise) {
			o.overrideSettings.wideRootNoise = 0.05;
		}

		return o;
	},

	has_valid_analysis: function() {												// Don't do the cheap way; return only true or false.
		if (typeof this.analysis === "object" && this.analysis !== null) {
			if (Array.isArray(this.analysis.moveInfos) && this.analysis.moveInfos.length > 0 && this.analysis.rootInfo) {
				return true;
			}
		}
		return false;
	},

	detach: function() {

		// Returns the node that the hub should point to,
		// which is the parent unless the call is a bad one.

		let parent = this.parent;
		if (!parent) return this;		// Fail

		parent.children = parent.children.filter(child => child !== this);

		this.parent = null;
		this.destroy_tree();
		return parent;
	},

	destroy_tree: function() {
		destroy_tree(this.get_root());
	},

	coerce_komi: function(value) {
		let root = this.get_root();
		root.force_set("KM", value);
		coerce_komi_recursive(root, value);
	},

	receive_analysis: function(o) {
		this.analysis = o;
		if (this.has_valid_analysis() === false) {
			this.analysis = null;
		}
		this.update_sbkv();
	},

	update_sbkv: function() {

		if (this.has_valid_analysis() === false) {
			this.force_delete_key("SBKV");
			return;
		}

		let winrate = this.analysis.moveInfos[0].winrate;

		if (this.get_board().active === "w") {
			winrate = 1 - winrate;
		}

		if (winrate < 0) winrate = 0;
		if (winrate > 1) winrate = 1;

		let val = (winrate * 100).toFixed(2);

		this.force_set("SBKV", val);
	},

	string: function() {

		let list = [];

		for (let key of Object.keys(this.props)) {

			let vals = this.all_values(key);

			if (vals.length === 0) {		// Should be impossible.
				continue;
			}

			let safe_vals = [];

			for (let val of vals) {
				safe_vals.push(safe_sgf_string(val));
			}

			let s = key + "[" + safe_vals.join("][") + "]";
			list.push(s);
		}

		return ";" + list.join("");
	}
};

// ------------------------------------------------------------------------------------------------

function safe_sgf_string(s) {

	if (typeof s !== "string") {
		return undefined;
	}

	s = replace_all(s, "\\", "\\\\");		// Must be first.
	s = replace_all(s, "]", "\\]");

	return s;
}

// ------------------------------------------------------------------------------------------------

function destroy_tree(node) {

	while (true) {

		let children = node.children;

		node.parent = null;
		node.children = [];
		node.props = Object.create(null);
		node.analysis = null;
		node.__board = null;
		node.destroyed = true;

		if (children.length > 1) {
			for (let child of children) {
				destroy_tree(child);
			}
			break;
		} else if (children.length === 1) {
			node = children[0];
			continue;
		} else {
			break;
		}
	}
}

function coerce_komi_recursive(node, komi) {

	while (true) {

		if (node.__board) {
			node.__board.komi = komi;
		}

		if (node.children.length > 1) {
			for (let child of node.children) {
				coerce_komi_recursive(child, komi);
			}
			break;
		} else if (node.children.length === 1) {
			node = node.children[0];
			continue;
		} else {
			break;
		}
	}
}

// ------------------------------------------------------------------------------------------------

module.exports = new_node;
