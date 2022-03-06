"use strict";

// The node object contains the state of an SGF node, i.e. a node in a game tree.
// SGF properties are stored as a map of key --> list of values, with everything
// being stored as a string.

const path = require("path");

const new_board = require("./board");
const stringify = require("./stringify");
const {replace_all, valid_analysis_object} = require("./utils");

let next_node_id = 1;

// ------------------------------------------------------------------------------------------------

function new_node(parent) {

	let node = Object.create(node_prototype);

	node.id = `node_${next_node_id++}`;
	node.parent = parent;
	node.children = [];
	node.props = Object.create(null);			// key --> list of values (strings only)
	node.analysis = null;
	node.__board = null;
	node.__blessed_child_id = null;				// Usually don't inspect this directly, rather call get_blessed_child()

	if (parent) {
		parent.children.push(node);
		node.graph_depth_knower = parent.graph_depth_knower;		// 1 object every node points to, a bit lame
		node.depth = parent.depth + 1;
	} else {
		node.graph_depth_knower = {val: 60};
		node.depth = 0;
		node.filepath = "";											// Gets adjusted from outside
		node.save_ok = false;										// Gets adjusted from outside
	}

	if (node.depth > node.graph_depth_knower.val) {
		node.graph_depth_knower.val = node.depth;
	}

	return node;
}

// ------------------------------------------------------------------------------------------------

let node_prototype = {

	set: function(key, value) {
		this.props[key] = [stringify(value)];
	},

	add_value: function(key, value) {
		if (this.__board) {
			throw "add_value() called on node but board already existed";
		}
		if (!this.has_key(key)) {
			this.props[key] = [stringify(value)];
		} else {
			this.props[key].push(stringify(value));
		}
	},

	force_add_value: function(key, value) {
		if (!this.has_key(key)) {
			this.props[key] = [stringify(value)];
		} else {
			this.props[key].push(stringify(value));
		}
	},

	delete_key: function(key) {
		if (this.__board) {
			throw "delete_key() called on node but board already existed";
		}
		delete this.props[key];
	},

	force_delete_key: function(key) {
		delete this.props[key];
	},

	has_key: function(key) {
		return Array.isArray(this.props[key]);
	},

	get: function(key) {				// On the assumption there is at most 1 value for this key.

		// Always returns a string. Some stuff relies on this now. (We used to return undefined.)
		// Note that an actual value could be "" so simply checking the return value for truthiness
		// is not valid for checking if the key exists. Call node.has_key() if that's important.

		if (!this.has_key(key)) {
			return "";
		}
		return this.props[key][0];
	},

	all_values: function(key) {
		let ret = [];
		if (!this.has_key(key)) {
			return ret;
		}
		for (let value of this.props[key]) {
			ret.push(value);
		}
		return ret;
	},

	bless: function() {

		let node = this;

		while (node.parent) {
			if (node.parent.children.length === 1) {
				node.parent.__blessed_child_id = null;
			} else {
				node.parent.__blessed_child_id = node.id;
			}
			node = node.parent;
		}
	},

	get_blessed_child: function() {

		if (this.children.length === 0) {
			return undefined;
		} else if (!this.__blessed_child_id) {
			return this.children[0];
		} else if (this.children.length === 1) {
			this.__blessed_child_id = null;
			return this.children[0];
		}

		for (let child of this.children) {
			if (child.id === this.__blessed_child_id) {
				return child;
			}
		}

		// Best not assume the stored id actually exists - if we get here, it didn't.

		this.__blessed_child_id = null;
		return this.children[0];
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
			node = node.get_blessed_child();
		}
		return node;
	},

	has_pass: function() {		// That is, in the node properties, not the analysis!

		let moves = this.all_values("B").concat(this.all_values("W"));

		for (let move of moves) {
			if (!this.get_board().in_bounds(move)) {
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
		if (!Number.isNaN(sz) && sz > 0 && sz <= 25) {
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
		if (!Number.isNaN(sz) && sz > 0 && sz <= 25) {
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

	greater_sibling: function() {									// The sibling to the left
		if (!this.parent || this.parent.children.length < 2) {
			return undefined;
		}
		let i = this.parent.children.indexOf(this);
		if (i > 0) {
			return this.parent.children[i - 1];
		}
		return undefined;
	},

	lesser_sibling: function() {									// The sibling to the right
		if (!this.parent || this.parent.children.length < 2) {
			return undefined;
		}
		let i = this.parent.children.indexOf(this);
		if (i < this.parent.children.length - 1) {
			return this.parent.children[i + 1];
		}
		return undefined;
	},

	get_board: function() {

		if (this.__board) {
			return this.__board;
		}

		let nodes_without_boards = [];

		let nd = this;
		while (nd && !nd.__board) {
			nodes_without_boards.push(nd);
			nd = nd.parent;
		}
		nodes_without_boards.reverse();

		for (let node of nodes_without_boards) {

			if (!node.parent) {
				node.__board = new_board(node.width(), node.height());
			} else {
				node.__board = node.parent.__board.copy();
			}

			for (let s of node.all_values("AE")) {
				node.__board.add_empty(s);
			}

			for (let s of node.all_values("AB")) {
				node.__board.add_black(s);
			}

			for (let s of node.all_values("AW")) {
				node.__board.add_white(s);
			}

			if (node.has_key("AB") && !node.has_key("AW")) node.__board.active = "w";
			if (!node.has_key("AB") && node.has_key("AW")) node.__board.active = "b";

			for (let s of node.all_values("B")) {
				node.__board.play_black(s);				// Will treat s as a pass if it's not a valid move.
			}

			for (let s of node.all_values("W")) {
				node.__board.play_white(s);				// Will treat s as a pass if it's not a valid move.
			}

			let pl = node.get("PL");
			if (pl[0] === "B" || pl[0] === "b" || pl === "1") node.__board.active = "b";
			if (pl[0] === "W" || pl[0] === "w" || pl === "2") node.__board.active = "w";

			let km = parseFloat(node.get("KM"));
			if (!Number.isNaN(km)) {
				node.__board.komi = km;
			}

			let ru = node.get("RU");
			if (ru) {
				node.__board.rules = ru;
			}
		}

		return this.__board;
	},

	try_move: function(s) {							// Note: not to be used for passing.
		let board = this.get_board();
		if (!board.legal_move(s)) {
			return this;
		}
		return this.force_move(s);
	},

	force_move: function(s) {						// Note: not to be used for passing.

		let board = this.get_board();
		let propkey = board.active.toUpperCase();

		for (let child of this.children) {
			if (child.has_key(propkey)) {
				if (child.get(propkey) === s) {
					return child;
				}
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
			if (child.has_key(propkey)) {
				if (!board.in_bounds(child.get(propkey))) {
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

	bless_main_line: function() {

		let node = this.get_root();

		while (node.children.length > 0) {
			if (node.children.length === 1) {
				node.__blessed_child_id = null;
			} else {
				node.__blessed_child_id = node.children[0].id;
			}
			node = node.children[0];
		}
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

		let node = this.get_blessed_child();		// Start at child so as not to return <this> even if <this> is a fork. We want the next fork.

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

	backward_helper: function(n) {

		let node = this;

		while (node.parent && n-- > 0) {
			node = node.parent;
		}

		return node;
	},

	forward_helper: function(n) {

		let node = this;

		while (node.children.length > 0 && n-- > 0) {
			node = node.get_blessed_child();
		}

		return node;
	},

	ancestor_with_valid_analysis: function(depth, initial_call = true) {

		if (!initial_call && this.has_valid_analysis()) {
			return this;
		}

		if (depth <= 0 || !this.parent) {
			return null;
		}

		return this.parent.ancestor_with_valid_analysis(depth - 1, false);
	},

	descendant_with_valid_analysis: function(depth, initial_call = true) {

		if (!initial_call && this.has_valid_analysis()) {
			return this;
		}

		if (depth <= 0 || this.children.length === 0) {
			return null;
		}

		return this.children[0].descendant_with_valid_analysis(depth - 1, false);
	},

	anc_dec_with_valid_analysis: function(depth) {
		let ret = this.ancestor_with_valid_analysis(depth);
		if (ret) {
			return ret;
		}
		return this.descendant_with_valid_analysis(depth);
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

	is_bare_root: function() {
		return !this.parent && this.children.length === 0;
	},

	detach: function() {

		let parent = this.parent;
		if (!parent) return;			// Fail

		// The following replaces the children array, rather than mutating it, so it's actually safe to iterate over some
		// node's children and detach some of them, because the iteration will be over the original (unchanging) array.

		parent.children = parent.children.filter(child => child !== this);

		this.parent = null;
		destroy_tree_recursive(this);
	},

	detach_siblings: function() {

		let parent = this.parent;
		if (!parent || parent.children.length === 1) return;

		for (let sibling of parent.children) {
			if (sibling !== this) {
				sibling.parent = null;
				destroy_tree_recursive(sibling);
			}
		}

		parent.children = [this];
	},

	detach_children: function() {

		for (let child of this.children) {
			child.parent = null;
			destroy_tree_recursive(child);
		}

		this.children = [];
	},

	destroy_tree: function() {
		destroy_tree_recursive(this.get_root());
	},

	coerce_komi: function(value) {
		let root = this.get_root();
		root.set("KM", value);
		coerce_board_prop_recursive(root, "komi", value);
	},

	coerce_rules: function(value) {
		let root = this.get_root();
		root.set("RU", value);
		coerce_board_prop_recursive(root, "rules", value);
	},

	forget_analysis_tree: function() {
		forget_analysis_recursive(this.get_root());
	},

	forget_analysis: function() {
		this.analysis = null;
		this.force_delete_key("SBKV");
		this.force_delete_key("OGSC");
	},

	has_valid_analysis: function() {
		return valid_analysis_object(this.analysis);
	},

	receive_analysis: function(o) {

		// Save a KataGo analysis object into the node for display.
		// No validation... caller should run valid_analysis_object(o) first!

		this.analysis = o;

		let winrate = this.analysis.moveInfos[0].winrate * 100;		// SBKV is 0..100
		if (winrate < 0) winrate = 0;
		if (winrate > 100) winrate = 100;
		if (this.get_board().active === "w") {
			winrate = 100 - winrate;
		}
		let val = (winrate).toFixed(1);
		this.set("SBKV", val);

		let score = this.analysis.moveInfos[0].scoreLead;
		if (this.get_board().active === "w") {
			score = -score;
		}
		val = score.toFixed(1);
		this.set("OGSC", val);
	},

	game_title_text: function() {

		let root = this.get_root();

		if (root.has_key("PB") || root.has_key("PW")) {

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

		// Returns a ;-prefixed string which can be saved into an SGF file.

		let list = [];

		let keys = Object.keys(this.props);		// Object.keys() usually returns things in insertion order.

		if (!this.parent) {
			keys.sort((a, b) => {				// This sort pattern moves certain specified things to the start.
				if (a === b) return 0;			// Impossible in this exact case.
				if (a === "GM") return -1; if (b === "GM") return 1;
				if (a === "FF") return -1; if (b === "FF") return 1;
				if (a === "CA") return -1; if (b === "CA") return 1;
				return 0;
			});
		}

		for (let key of keys) {

			let vals = this.all_values(key);

			if (vals.length === 0) {			// Should be impossible.
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

	// Used for setting things like komi and rules in
	// all boards (NOT nodes) in the tree.

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
