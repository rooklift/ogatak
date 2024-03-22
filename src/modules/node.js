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
const {replace_all, valid_analysis_object, handicap_stones, points_list, xy_to_s} = require("./utils");

const MIN_GRAPH_DEPTH = 60;

let next_node_id = 1;
let have_alerted_zobrist_mismatch = false;

// ------------------------------------------------------------------------------------------------

function new_node(...args) {
	return new Node(...args);
}

class Node {

	constructor(parent) {

		this.change_id();

		this.parent = parent;
		this.children = [];
		this.props = Object.create(null);			// key --> list of values (strings only)
		this.analysis = null;
		this.__board = null;
		this.__blessed_child_id = null;				// Usually don't inspect this directly, rather call get_blessed_child()

		if (!parent) {								// This is a new root...

			this.__root = this;
			this.graph_depth = MIN_GRAPH_DEPTH;
			this.depth = 0;
			this.filepath = "";						// Gets adjusted from outside
			this.save_ok = false;					// Gets adjusted from outside

		} else {

			parent.children.push(this);
			this.__root = parent.__root;			// Usually don't access this directly, call get_root() so that bugs will show up if it's not valid.
			this.depth = parent.depth + 1;

			if (this.depth > this.__root.graph_depth) {
				this.__root.graph_depth = this.depth;
			}

		}
	}

	change_id() {
		if (!this.id) {
			this.id = `node_${next_node_id++}`;
		} else {
			let old_id = this.id;
			this.id = `node_${next_node_id++}`;
			if (this.parent && this.parent.__blessed_child_id === old_id) {
				this.parent.__blessed_child_id = this.id;
			}
		}
	}

	set(key, value) {
		this.props[key] = [stringify(value)];
	}

	add_value(key, value) {
		if (!this.has_key(key)) {
			this.props[key] = [stringify(value)];
		} else {
			this.props[key].push(stringify(value));
		}
	}

	unset(key, value) {
		if (!this.has_key(key)) {
			return;
		}
		value = stringify(value);
		this.props[key] = this.props[key].filter(z => z !== value);
		if (this.props[key].length === 0) {
			delete this.props[key];
		}
	}

	unset_starts_with(key, value) {
		if (!this.has_key(key)) {
			return;
		}
		value = stringify(value);
		this.props[key] = this.props[key].filter(z => !z.startsWith(value));
		if (this.props[key].length === 0) {
			delete this.props[key];
		}
	}

	delete_key(key) {
		delete this.props[key];
	}

	has_key(key) {
		return Array.isArray(this.props[key]);
	}

	has_key_value(key, value) {
		if (!this.has_key(key)) {
			return false;
		}
		return this.props[key].indexOf(stringify(value)) !== -1;
	}

	has_key_value_starts_with(key, value) {
		if (!this.has_key(key)) {
			return false;
		}
		value = stringify(value);
		return this.props[key].some(z => z.startsWith(value));
	}

	get(key) {				// On the assumption there is at most 1 value for this key.

		// Always returns a string. Some stuff relies on this now. (We used to return undefined.)
		// Note that an actual value could be "" so simply checking the return value for truthiness
		// is not valid for checking if the key exists. Call node.has_key() if that's important.

		if (!this.has_key(key)) {
			return "";
		}
		return this.props[key][0];
	}

	all_keys() {
		return Object.keys(this.props);
	}

	all_values(key) {
		let ret = [];
		if (!this.has_key(key)) {
			return ret;
		}
		for (let value of this.props[key]) {
			ret.push(value);
		}
		return ret;
	}

	decompress_shapes() {
		this.decompress_points_list("TR");
		this.decompress_points_list("MA");
		this.decompress_points_list("SQ");
		this.decompress_points_list("CR");
	}

	unset_marks_at(point) {
		this.unset("TR", point);
		this.unset("MA", point);
		this.unset("SQ", point);
		this.unset("CR", point);
		this.unset_starts_with("LB", `${point}:`);
	}

	toggle_shape_at(key, point) {

		this.decompress_shapes();

		let exists = this.has_key_value(key, point);

		this.unset_marks_at(point);

		if (!exists) {
			this.add_value(key, point);
		}
	}

	toggle_shape_at_group(key, point) {

		let group = this.get_board().group_at(point);

		if (group.length === 0) {

			this.toggle_shape_at(key, point);

		} else {

			this.decompress_shapes();

			let exists = this.has_key_value(key, point);

			for (let s of group) {

				this.unset_marks_at(s);

				if (!exists) {
					this.add_value(key, s);
				}
			}
		}
	}

	toggle_alpha_at(point) {

		this.decompress_shapes();

		let exists = this.has_key_value_starts_with("LB", `${point}:`);

		this.unset_marks_at(point);

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
	}

	toggle_number_at(point) {

		this.decompress_shapes();

		let exists = this.has_key_value_starts_with("LB", `${point}:`);

		this.unset_marks_at(point);

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
	}

	bless() {

		let node = this;

		while (node.parent) {
			if (node.parent.children.length === 1) {
				node.parent.__blessed_child_id = null;
			} else {
				node.parent.__blessed_child_id = node.id;
			}
			node = node.parent;
		}
	}

	get_blessed_child() {

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
	}

	get_root() {
		if (!this.__root) {
			throw new Error("get_root(): root not available");
		}
		return this.__root;
	}

	get_end() {
		let node = this;
		while (node.children.length > 0) {
			node = node.get_blessed_child();
		}
		return node;
	}

	has_pass() {		// That is, in the node properties, not the analysis!

		let moves = this.all_values("B").concat(this.all_values("W"));

		for (let move of moves) {
			if (!this.get_board().in_bounds(move)) {
				return true;
			}
		}

		return false;
	}

	safe_to_edit() {
		if (this.children.length > 0) {
			return false;
		}
		if (this.has_key("B") || this.has_key("W")) {
			return false;
		}
		return true;
	}

	decompress_points_list(key) {

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
	}

	delete_markup() {
		for (let key of ["TR", "MA", "SQ", "CR", "LB"]) {
			this.delete_key(key);
		}
	}

	apply_handicap(handicap, tygem) {

		// IMPORTANT: Because this changes the board, the caller should likely halt the engine and change the node id.

		if (!handicap || handicap < 2) {
			return;
		}

		if (this.parent || this.children.length > 0) {
			throw new Error("apply_handicap(): invalid node to apply handicap to");
		}

		for (let key of ["AB", "AW", "B", "W", "HA", "PL"]) {
			this.delete_key(key);
		}

		let points = handicap_stones(handicap, this.width(), this.height(), tygem);
		for (let point of points) {
			this.add_value("AB", point);
		}
		if (points.length > 1) {
			this.set("HA", points.length);
		}

		this.__board = null;
	}

	apply_board_edit(key, point) {

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
	}

	interpret_pl(s) {

		// Returns who the active player should be, based on the node's PL tag, or null if it cannot.

		let pl = this.get("PL");

		if (pl) {
			if (pl[0] === "B" || pl[0] === "b" || pl === "1") return "b";
			if (pl[0] === "W" || pl[0] === "w" || pl === "2") return "w";
		}

		return null;								// Caller needs to check for this return value.
	}

	natural_active() {

		// Returns who the active player should be (ignoring PL tags), or null if it can't be determined from this node alone.

		if (this.has_key("W")) return "b";			// This prevails if both B and W tags exist.
		if (this.has_key("B")) return "w";

		if (!this.parent) {
			if (this.has_key("AB") && !this.has_key("AW")) {
				return "w";
			} else {
				return "b";
			}
		}

		return null;								// Caller needs to check for this return value.
	}

	toggle_player_to_move() {

		// IMPORTANT: Because this changes the board, the caller should likely halt the engine and change the node id.
		// We go through some rigmarol to not leave PL tags where there is enough info in the node that they're redundant...

		let natural = this.natural_active();		// Possibly null.

		let desired = (this.get_board().active === "b") ? "w" : "b";

		if (natural === desired) {
			this.delete_key("PL");
		} else {
			this.set("PL", desired.toUpperCase());
		}
		this.get_board().active = desired;			// I guess it's simple enough to update this directly.
	}

	width() {
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
	}

	height() {
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
	}

	history_reversed() {
		let ret = [this];
		let node = this;
		while (node.parent) {
			node = node.parent;
			ret.push(node);
		}
		return ret;
	}

	history() {
		return this.history_reversed().reverse();
	}

	greater_sibling() {												// The sibling to the left
		if (!this.parent || this.parent.children.length < 2) {
			return undefined;
		}
		let i = this.parent.children.indexOf(this);
		if (i > 0) {
			return this.parent.children[i - 1];
		}
		return undefined;
	}

	lesser_sibling() {												// The sibling to the right
		if (!this.parent || this.parent.children.length < 2) {
			return undefined;
		}
		let i = this.parent.children.indexOf(this);
		if (i < this.parent.children.length - 1) {
			return this.parent.children[i + 1];
		}
		return undefined;
	}

	rules() {
		return this.get_root().get("RU");							// Possibly ""
	}

	komi() {														// Always a number
		let km = this.get_root().get("KM");
		if (km === "") {
			return 0;
		}
		let val = parseFloat(km);
		if (!Number.isNaN(val)) {
			return val;
		} else {
			return 0;
		}
	}

	get_board() {

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

			// Create or copy the board...

			if (!node.parent) {
				node.__board = new_board(node.width(), node.height());
			} else {
				node.__board = node.parent.__board.copy();
			}

			// Adjust the board from the node's board-changing properties...

			for (let s of node.all_values("AE")) {
				node.__board.add_empty(s);						// Clears any ko.
			}

			for (let s of node.all_values("AB")) {
				node.__board.add_black(s);						// As above.
			}

			for (let s of node.all_values("AW")) {
				node.__board.add_white(s);						// As above.
			}

			for (let s of node.all_values("B")) {				// board.play() will treat s as a pass if it's not a valid move.
				node.__board.play(s, "b");						// It sets .active but that's irrelevant since we set it below.
			}													// It clears or sets the ko.

			for (let s of node.all_values("W")) {
				node.__board.play(s, "w");						// As above.
			}

			// Set the active player if possible (these calls return null if they can't)...

			node.__board.active = node.interpret_pl() || node.natural_active() || node.__board.active;
		}

		return this.__board;
	}

	try_move(s) {												// Note: not to be used for passing.
		let board = this.get_board();
		if (!board.legal_move(s)) {
			return this;
		}
		return this.force_move(s);
	}

	force_move(s) {												// Note: not to be used for passing.

		let board = this.get_board();
		let key = board.active.toUpperCase();

		for (let child of this.children) {
			if (child.has_key_value(key, s)) {
				return child;
			}
		}

		let node = new_node(this);
		node.set(key, s);

		return node;
	}

	pass() {

		let board = this.get_board();
		let key = board.active.toUpperCase();

		for (let child of this.children) {
			if (child.has_key(key)) {
				if (!board.in_bounds(child.get(key))) {
					return child;
				}
			}
		}

		let node = new_node(this);
		node.set(key, "");

		return node;
	}

	return_to_main_line_helper() {

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
	}

	bless_main_line() {

		let node = this.get_root();

		while (node.children.length > 0) {
			if (node.children.length === 1) {
				node.__blessed_child_id = null;
			} else {
				node.__blessed_child_id = node.children[0].id;
			}
			node = node.children[0];
		}
	}

	previous_fork_helper() {

		let node = this;

		while (node.parent) {
			if (node.parent.children.length > 1) {
				return node.parent;
			}
			node = node.parent;
		}

		return this;
	}

	next_fork_helper() {

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
	}

	backward_helper(n) {

		let node = this;

		while (node.parent && n-- > 0) {
			node = node.parent;
		}

		return node;
	}

	forward_helper(n) {

		let node = this;

		while (node.children.length > 0 && n-- > 0) {
			node = node.get_blessed_child();
		}

		return node;
	}

	ancestor_with_valid_analysis(depth, initial_call = true) {

		if (!initial_call && this.has_valid_analysis()) {
			return this;
		}

		if (depth <= 0 || !this.parent) {
			return null;
		}

		return this.parent.ancestor_with_valid_analysis(depth - 1, false);
	}

	descendant_with_valid_analysis(depth, initial_call = true) {

		if (!initial_call && this.has_valid_analysis()) {
			return this;
		}

		if (depth <= 0 || this.children.length === 0) {
			return null;
		}

		return this.children[0].descendant_with_valid_analysis(depth - 1, false);
	}

	anc_dec_with_valid_analysis(depth) {
		let ret = this.ancestor_with_valid_analysis(depth);
		if (ret) {
			return ret;
		}
		return this.descendant_with_valid_analysis(depth);
	}

	is_main_line() {

		let node = this;

		while (node.parent) {
			if (node.parent.children[0] !== node) {
				return false;
			}
			node = node.parent;
		}

		return true;
	}

	is_bare_root() {
		return !this.parent && this.children.length === 0 && !this.has_key("AB") && !this.has_key("AW") && !this.has_key("B") && !this.has_key("W");
	}

	fix_tree_depths() {
		let deepest = fix_depths_recursive(this.get_root(), 0);
		this.get_root().graph_depth = Math.max(deepest, MIN_GRAPH_DEPTH);
	}

	detach() {

		let parent = this.parent;
		if (!parent) return;			// Fail

		// The following replaces the children array, rather than mutating it, so it's actually safe to iterate over some
		// node's children and detach some of them, because the iteration will be over the original (unchanging) array.

		parent.children = parent.children.filter(child => child !== this);

		destroy_tree_recursive(this);
	}

	detach_siblings() {

		let parent = this.parent;
		if (!parent || parent.children.length === 1) return;

		for (let sibling of parent.children) {
			if (sibling !== this) {
				destroy_tree_recursive(sibling);
			}
		}

		parent.children = [this];
	}

	detach_children() {

		for (let child of this.children) {
			destroy_tree_recursive(child);
		}

		this.children = [];
	}

	destroy_tree() {
		destroy_tree_recursive(this.get_root());
	}

	forget_analysis_tree() {
		forget_analysis_recursive(this.get_root());
	}

	forget_analysis() {
		this.analysis = null;
		this.delete_key("SBKV");
		this.delete_key("OGSC");
	}

	move_count() {
		return (this.has_key("B") ? this.props.B.length : 0) + (this.has_key("W") ? this.props.W.length : 0);
	}

	has_valid_analysis() {
		return valid_analysis_object(this.analysis);
	}

	receive_analysis(o) {

		// Save a KataGo analysis object into the node for display.
		// No real validation... caller should run valid_analysis_object(o) first!

		if (!have_alerted_zobrist_mismatch) {
			if (config.zobrist_checks && o.rootInfo.thisHash) {
				let z = this.get_board().zobrist_string();
				if (z !== o.rootInfo.thisHash) {
					alert(	"The Zobrist hash of the board position did not match that reported by KataGo. " +
							"This test exists for development purposes and you can disable it in the menu.");
					have_alerted_zobrist_mismatch = true;
				}
			}
		}

		this.analysis = o;

		// this.analysis.moveInfos.sort((a, b) => a.order - b.order);		// KataGo already sends it this way.

		let winrate = this.analysis.rootInfo.winrate * 100;			// SBKV is 0..100
		if (winrate < 0) winrate = 0;
		if (winrate > 100) winrate = 100;
		let val = (winrate).toFixed(1);
		this.set("SBKV", val);

		let score = this.analysis.rootInfo.scoreLead;

		if (typeof score === "number") {							// scoreLead might not be present if it's a GTP engine.
			val = score.toFixed(1);
			this.set("OGSC", val);
		} else {
			this.delete_key("OGSC");
		}
	}

	stored_score() {
		if (this.has_valid_analysis()) {
			let score = this.analysis.rootInfo.scoreLead;
			if (typeof score === "number") {						// scoreLead might not be present if it's a GTP engine.
				return score;
			} else {
				return null;
			}
		} else {
			let ogsc = this.get("OGSC");
			if (ogsc) {
				let score = parseFloat(ogsc);
				if (!Number.isNaN(score)) {
					return score;
				} else {
					return null;
				}
			} else {
				return null;
			}
		}
	}

	stored_winrate() {
		if (this.has_valid_analysis()) {
			let winrate = this.analysis.rootInfo.winrate;
			if (typeof winrate === "number") {
				if (winrate < 0) winrate = 0;
				if (winrate > 1) winrate = 1;
				return winrate;
			} else {
				return null;
			}
		} else {
			let sbkv = this.get("SBKV");
			if (sbkv) {
				let winrate = parseFloat(sbkv);
				if (!Number.isNaN(winrate)) {
					if (winrate < 0) winrate = 0;
					if (winrate > 100) winrate = 100;
					return winrate / 100;
				} else {
					return null;
				}
			} else {
				return null;
			}
		}
	}

	// These 4 functions are a rather tangled web, but there's no recursion........................

	best_policy_move() {				// Result in SGF format e.g. "qq", (pass is "")
		if (!this.has_valid_analysis()) {
			return null;
		}
		if (!Array.isArray(this.analysis.policy)) {
			return this.best_policy_move_alt();
		}
		let best_index = this.analysis.policy.reduce((result, prior, i, arr) => prior > arr[result] ? i : result, 0);
		if (best_index >= this.width() * this.height()) {
			return "";
		}
		let x = best_index % this.width();
		let y = Math.floor(best_index / this.width());
		let s = xy_to_s(x, y);
		return this.canonical_symmetry(s);
	}

	best_policy_move_alt() {			// Alternative for when analysis.policy doesn't exist.
		if (!this.has_valid_analysis()) {
			return null;
		}
		let best_info = this.analysis.moveInfos.reduce((best, info) => info.prior > best.prior ? info : best);
		let s = this.get_board().parse_gtp_move(best_info.move);
		return this.canonical_symmetry(s);
	}

	drunk_policy_move() {				// Weighted random choice from the policy.
		if (!this.has_valid_analysis()) {
			return null;
		}
		if (!Array.isArray(this.analysis.policy)) {
			return this.drunk_policy_move_alt();
		}
		let best_policy_move = this.best_policy_move();
		if (best_policy_move === "") {			// Pass if it's the best policy.
			return "";
		}
		let policy_sum = this.analysis.policy.reduce((sum, prior) => prior > 0 ? sum + prior : sum, 0);
		let rnd = Math.random() * policy_sum;
		let acc = 0;
		let result = null;
		for (let n = 0; n < this.analysis.policy.length; n++) {
			let prior = this.analysis.policy[n];
			if (prior < 0) {
				continue;						// Illegal move flag.
			}
			acc += prior;
			if (acc >= rnd) {
				result = n;
				break;
			}
		}
		if (result === null) {
			return best_policy_move;			// Due to floating point error, we didn't get a result. Return best policy.
		}
		if (result === this.analysis.policy.length - 1) {
			return best_policy_move;			// We wanted to pass. Return best policy instead.
		}
		let x = result % this.width();
		let y = Math.floor(result / this.width());
		let s = xy_to_s(x, y);
		return this.canonical_symmetry(s);
	}

	drunk_policy_move_alt() {			// Alternative for when analysis.policy doesn't exist.
		if (!this.has_valid_analysis()) {
			return null;
		}
		let best_policy_move = this.best_policy_move_alt();
		if (best_policy_move === "") {			// Pass if it's the best policy.
			return "";
		}
		let valid_infos = this.analysis.moveInfos.filter(info => info.prior && info.prior > 0);
		let policy_sum = valid_infos.reduce((sum, info) => sum + info.prior, 0);
		if (policy_sum === 0) {
			return null;
		}
		let rnd = Math.random() * policy_sum;
		let acc = 0;
		let result = null;
		for (let info of valid_infos) {
			acc += info.prior;
			if (acc >= rnd) {
				result = info;
				break;
			}
		}
		if (result === null) {
			return best_policy_move;
		}
		if (result.move === "pass") {			// We wanted to pass. Return best policy instead.
			return best_policy_move;
		}
		let s = this.get_board().parse_gtp_move(result.move);
		return this.canonical_symmetry(s);
	}

	canonical_symmetry(s) {			// Given a move e.g. "dd", return the canonical symmetry version of that move, if available.
		if (!this.has_valid_analysis()) {
			return s;
		}
		let g = this.get_board().gtp(s);
		for (let o of this.analysis.moveInfos) {
			if (o.move === g) {
				if (o.isSymmetryOf) {
					return this.get_board().parse_gtp_move(o.isSymmetryOf);
				} else {
					return s;
				}
			}
		}
		return s;
	}

	reset_mismatch_warnings() {
		have_alerted_zobrist_mismatch = false;	// Note this is a module var, not actually part of the node.
	}

	game_title_text() {

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
	}

	string() {

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
	}
}

// ------------------------------------------------------------------------------------------------

function safe_sgf_string(s) {

	if (typeof s !== "string") {
		return undefined;
	}

	s = replace_all(s, "\\", "\\\\");		// Must be first.
	s = replace_all(s, "]", "\\]");

	return s;
}

function destroy_tree_recursive(node) {

	while (true) {

		let children = node.children;

		node.parent = null;
		node.children = [];
		node.props = Object.create(null);
		node.analysis = null;
		node.__board = null;
		node.destroyed = true;
		node.__root = null;

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

function fix_depths_recursive(node, depth) {		// Returns the depth of the deepest node in the recurse.

	while (true) {
		node.depth = depth++;
		if (node.children.length > 1) {
			let deepest_subtree = 0;
			for (let child of node.children) {
				let d = fix_depths_recursive(child, depth);
				if (d > deepest_subtree) {
					deepest_subtree = d;
				}
			}
			return deepest_subtree;
		} else if (node.children.length === 1) {
			node = node.children[0];
			continue;
		} else {
			return node.depth;						// Which is not the same as depth now since we did depth++
		}
	}
}

// Add in some extra methods for debugging, etc, which are in another file.........................
Object.assign(Node.prototype, require("./node_debug"));



module.exports = new_node;

