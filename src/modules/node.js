"use strict";

const path = require("path");

const new_board = require("./board");
const stringify = require("./stringify");
const {replace_all} = require("./utils");

let next_node_id = 1;

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
		node.filepath = "";											// Gets adjusted from outside
		node.save_ok = false;										// Gets adjusted from outside
	}

	if (node.depth > node.graph_length_knower.val) {
		node.graph_length_knower.val = node.depth;
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

	has_pass: function() {		// That is, in the node properties, not the analysis!

		let moves = this.all_values("B").concat(this.all_values("W"));

		for (let move of moves) {
			if (this.get_board().in_bounds(move) === false) {
				return true;
			}
		}

		return false;
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

	line_index: function() {
		return this.parent.children.indexOf(this);			// Not valid to call this on the root.
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

		let ru = this.get("RU");
		if (ru) {
			this.__board.rules = ru;
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

	return_to_variation_start_helper: function() {

		// Returns the EARLIEST ancestor that is off the main line, or returns self if it cannot.

		let ret = this;
		let node = this;

		while (node.parent) {
			if (node.parent.children[0] !== node) {
				ret = node;
			}
			node = node.parent;
		}

		return ret;
	},

	previous_fork_helper: function() {

		let node = this;

		while (node.parent) {
			if (node.parent.children.length > 1) {
				return node.parent;
			}
			node = node.parent;
		}

		return this;
	},

	next_fork_helper: function() {

		if (this.children.length === 0) {
			return this;
		}

		let node = this.children[0];		// Start at child so as not to return <this> even if <this> is a fork. We want the next fork.

		while (true) {
			if (node.children.length > 1) {
				return node;
			} else if (node.children.length === 1) {
				node = node.children[0];
			} else {
				return this;
			}
		}
	},

	is_main_line: function() {

		let node = this;

		while (node.parent) {
			if (node.parent.children[0] !== node) {
				return false;
			}
			node = node.parent;
		}

		return true;
	},

	detach: function() {

		// Returns the node that the hub should point to,
		// which is the parent unless the call is a bad one.

		let parent = this.parent;
		if (!parent) return this;		// Fail

		parent.children = parent.children.filter(child => child !== this);

		this.parent = null;
		destroy_tree_recursive(this);
		return parent;
	},

	destroy_tree: function() {
		destroy_tree_recursive(this.get_root());
	},

	coerce_komi: function(value) {
		let root = this.get_root();
		root.force_set("KM", value);
		coerce_board_prop_recursive(root, "komi", value);
	},

	coerce_rules: function(value) {
		let root = this.get_root();
		root.force_set("RU", value);
		coerce_board_prop_recursive(root, "rules", value);
	},

	forget_analysis_tree: function() {
		forget_analysis_recursive(this.get_root());
	},

	forget_analysis: function() {
		this.analysis = null;
		this.force_delete_key("SBKV");
	},

	has_valid_analysis: function() {												// Don't do the cheap way; return only true or false.
		if (typeof this.analysis === "object" && this.analysis !== null) {
			if (Array.isArray(this.analysis.moveInfos) && this.analysis.moveInfos.length > 0 && this.analysis.rootInfo) {
				return true;
			}
		}
		return false;
	},

	receive_analysis: function(o) {

		this.analysis = o;

		if (this.has_valid_analysis() === false) {
			this.forget_analysis();
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

	game_title_text: function() {

		let root = this.get_root();

		if (root.props.PB || root.props.PW) {

			let blackname = root.get("PB") || "Unknown";
			let whitename = root.get("PW") || "Unknown";

			let s = `${blackname} (B) vs ${whitename} (W)`;

			if (root.filepath) {
				s += ` : ${path.basename(root.filepath)}`;
			}

			return s;
		}

		if (root.filepath) {
			return path.basename(root.filepath);
		}

		return "";
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
	},
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

function destroy_tree_recursive(node) {

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
				destroy_tree_recursive(child);
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

function coerce_board_prop_recursive(node, prop, value) {

	while (true) {

		if (node.__board) {
			node.__board[prop] = value;
		}

		if (node.children.length > 1) {
			for (let child of node.children) {
				coerce_board_prop_recursive(child, prop, value);
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

function forget_analysis_recursive(node) {

	while (true) {

		node.forget_analysis();

		if (node.children.length > 1) {
			for (let child of node.children) {
				forget_analysis_recursive(child);
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
