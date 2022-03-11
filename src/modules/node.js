"use strict";

// The node object contains the state of an SGF node, i.e. a node in a game tree.
// SGF properties are stored as a map of key --> list of values, with everything being stored as a string.
//
// Note that the canonical source of WHICH COLOUR THE NEXT MOVE SHOULD BE is always get_board().active, no exceptions.
// If there's any discrepancy between get_board().active and what you'd expect from node props, get_board().active prevails.
// Nothing in the codebase should depend on get_board().active matching what's in the node. Assume it could be either colour.

const path = require("path");

const new_board = require("./board");
const stringify = require("./stringify");
const {replace_all, valid_analysis_object, points_list} = require("./utils");

let next_node_id = 1;
let have_alerted_active_mismatch = false;

// ------------------------------------------------------------------------------------------------

function new_node(parent) {

	let node = Object.create(node_prototype);
	node.change_id();

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

	change_id: function() {
		if (!this.id) {
			this.id = `node_${next_node_id++}`;
		} else {
			let old_id = this.id;
			this.id = `node_${next_node_id++}`;
			if (this.parent && this.parent.__blessed_child_id === old_id) {
				this.parent.__blessed_child_id = this.id;
			}
		}
	},

	set: function(key, value) {
		this.props[key] = [stringify(value)];
	},

	add_value: function(key, value) {
		if (!this.has_key(key)) {
			this.props[key] = [stringify(value)];
		} else {
			this.props[key].push(stringify(value));
		}
	},

	unset: function(key, value) {
		if (!this.has_key(key)) {
			return;
		}
		value = stringify(value);
		this.props[key] = this.props[key].filter(z => z !== value);
		if (this.props[key].length === 0) {
			delete this.props[key];
		}
	},

	unset_starts_with(key, value) {
		if (!this.has_key(key)) {
			return;
		}
		value = stringify(value);
		this.props[key] = this.props[key].filter(z => !z.startsWith(value));
		if (this.props[key].length === 0) {
			delete this.props[key];
		}
	},

	delete_key: function(key) {
		delete this.props[key];
	},

	has_key: function(key) {
		return Array.isArray(this.props[key]);
	},

	has_key_value: function(key, value) {
		if (!this.has_key(key)) {
			return false;
		}
		return this.props[key].indexOf(stringify(value)) !== -1;
	},

	has_key_value_starts_with: function(key, value) {
		if (!this.has_key(key)) {
			return false;
		}
		value = stringify(value);
		return this.props[key].some(z => z.startsWith(value));
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

	toggle_shape_at: function(key, point) {

		this.decompress_points_list("TR");
		this.decompress_points_list("MA");
		this.decompress_points_list("SQ");
		this.decompress_points_list("CR");

		let exists = this.has_key_value(key, point);

		this.unset("TR", point);
		this.unset("MA", point);
		this.unset("SQ", point);
		this.unset("CR", point);
		this.unset_starts_with("LB", `${point}:`);

		if (!exists) {
			this.add_value(key, point);
		}
	},

	toggle_alpha_at: function(point) {

		this.decompress_points_list("TR");
		this.decompress_points_list("MA");
		this.decompress_points_list("SQ");
		this.decompress_points_list("CR");

		let exists = this.has_key_value_starts_with("LB", `${point}:`);

		this.unset("TR", point);
		this.unset("MA", point);
		this.unset("SQ", point);
		this.unset("CR", point);
		this.unset_starts_with("LB", `${point}:`);

		if (!exists) {

			let all_labels = Object.create(null);

			for (let value of this.all_values("LB")) {
				if (value[2] === ":") {
					all_labels[value.slice(3)] = true;
				}
			}

			for (let ch of "ABCDEFGHIJKLMNOPQRSTUVWXYZ") {
				if (!all_labels[ch]) {
					this.add_value("LB", `${point}:${ch}`);
					break;
				}
			}
		}
	},

	toggle_number_at: function(point) {

		this.decompress_points_list("TR");
		this.decompress_points_list("MA");
		this.decompress_points_list("SQ");
		this.decompress_points_list("CR");

		let exists = this.has_key_value_starts_with("LB", `${point}:`);

		this.unset("TR", point);
		this.unset("MA", point);
		this.unset("SQ", point);
		this.unset("CR", point);
		this.unset_starts_with("LB", `${point}:`);

		if (!exists) {

			let all_labels = Object.create(null);

			for (let value of this.all_values("LB")) {
				if (value[2] === ":") {
					all_labels[value.slice(3)] = true;
				}
			}

			for (let i = 1; i < 100; i++) {
				if (!all_labels[i.toString()]) {
					this.add_value("LB", `${point}:${i}`);
					break;
				}
			}
		}
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

	safe_to_edit: function() {
		if (this.children.length > 0) {
			return false;
		}
		if (this.has_key("B") || this.has_key("W")) {
			return false;
		}
		return true;
	},

	decompress_points_list: function(key) {

		let need_to_act = false;

		let all_values = this.all_values(key);

		for (let value of all_values) {
			if (value.length === 5 && value[2] === ":") {
				need_to_act = true;
				break;
			}
		}

		if (!need_to_act) {
			return;
		}

		let points = Object.create(null);

		for (let value of all_values) {
			let pl = points_list(value);
			for (let point of pl) {
				points[point] = true;
			}
		}

		this.delete_key(key);

		for (let point of Object.keys(points)) {
			this.add_value(key, point);
		}
	},

	apply_board_edit: function(key, point) {

		// IMPORTANT: Because this changes the board, the caller should likely halt the engine and change the node id.

		if (!this.get_board().in_bounds(point)) {
			return;
		}

		this.decompress_points_list("AB");
		this.decompress_points_list("AW");
		this.decompress_points_list("AE");

		let parent_state = (this.parent) ? this.parent.get_board().state_at(point) : "";
		let current_state = this.get_board().state_at(point);
		let desired_state;

		if ((key === "AB" && current_state === "b") || (key === "AW" && current_state === "w")) {
			desired_state = "";
		} else if (key === "AB") {
			desired_state = "b";
		} else if (key === "AW") {
			desired_state = "w";
		} else if (key === "AE") {
			desired_state = "";
		} else {
			throw new Error("apply_board_edit(): bad call");
		}

		this.unset("AB", point);
		this.unset("AW", point);
		this.unset("AE", point);

		if (desired_state !== parent_state) {
			if (desired_state === "")  this.add_value("AE", point);
			if (desired_state === "b") this.add_value("AB", point);
			if (desired_state === "w") this.add_value("AW", point);
		}

		this.__board = null;						// We could update __board, but this way ensures consistency with our normal get_board() result.
	},

	natural_active: function() {

		// Should correspond to the logic in get_board(). Except reverse order so the right thing prevails.
		// Ignores PL tags.
		
		if (this.has_key("W")) return "b";			// Just as in get_board(), this prevails if both B and W tags exist.
		if (this.has_key("B")) return "w";

		if (!this.parent) {
			if (this.has_key("AB") && !this.has_key("AW")) {
				return "w";
			} else {
				return "b";
			}
		}

		return null;		// Of course null is not a valid board.active value, so the caller must check.
	},

	toggle_player_to_move: function() {

		// IMPORTANT: Because this changes the board, the caller should likely halt the engine and change the node id.
		// We go through some rigmarol to not leave PL tags where there is enough info in the node that they're redundant...

		let natural = this.natural_active();		// Possibly null if .active can't be determined from this node's props.

		let desired = (this.get_board().active === "b") ? "w" : "b";

		if (natural === desired) {
			this.delete_key("PL");
		} else {
			this.set("PL", desired.toUpperCase());
		}
		this.get_board().active = desired;			// I guess it's simple enough to update this directly.
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
		if (!Number.isNaN(sz) && sz > 0) {
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
		if (!Number.isNaN(sz) && sz > 0) {
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

			// Note that any changes to the logic of setting .active should be mirrored in natural_active()
			// although it's not going to be catastrophic if they aren't (see note at top of file).

			// As of 1.3.1, AB and AW tags only affect .active if they are in the root...

			if (!node.parent) {
				if (node.has_key("AB") && !node.has_key("AW")) {
					node.__board.active = "w";
				} else {
					node.__board.active = "b";			// This will actually already be so.
				}
			}

			for (let s of node.all_values("B")) {
				node.__board.play_black(s);				// Will set __board.active... Will treat s as a pass if it's not a valid move.
			}

			for (let s of node.all_values("W")) {
				node.__board.play_white(s);				// Will set __board.active... Will treat s as a pass if it's not a valid move.
			}

			let pl = node.get("PL");
			if (pl && (pl[0] === "B" || pl[0] === "b" || pl === "1")) node.__board.active = "b";
			if (pl && (pl[0] === "W" || pl[0] === "w" || pl === "2")) node.__board.active = "w";

			// In the event that nothing whatsoever in the node determines the board colour, it will just be the same as the board we
			// copied at the start, which is fine I guess.

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
		return !this.parent && this.children.length === 0 && !this.has_key("AB") && !this.has_key("AW") && !this.has_key("B") && !this.has_key("W");
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
		this.delete_key("SBKV");
		this.delete_key("OGSC");
	},

	has_valid_analysis: function() {
		return valid_analysis_object(this.analysis);
	},

	receive_analysis: function(o) {

		// Save a KataGo analysis object into the node for display.
		// No validation... caller should run valid_analysis_object(o) first!

		if (o.rootInfo.currentPlayer && o.rootInfo.currentPlayer.toLowerCase() !== this.get_board().active) {
			if (!have_alerted_active_mismatch) {
				alert(	"There was a mismatch between the expected colour of KataGo's analysis, and the actual colour. " +
						"This is supposed to be impossible and the author of Ogatak would like to know how you made this happen.");
				have_alerted_active_mismatch = true;

				// It really should be impossible, because anything that changes .active will change the node.id
			}
		}

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



module.exports = new_node;
