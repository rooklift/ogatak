"use strict";

const fs = require("fs");
const {ipcRenderer} = require("electron");

const new_engine = require("./engine");
const new_gtp_engine = require("./engine_gtp");
const new_node = require("./node");

const load_gib = require("./load_gib");
const load_ngf = require("./load_ngf");
const load_sgf = require("./load_sgf");
const load_ugi = require("./load_ugi");
const new_load_results = require("./loader_results");
const make_perf_report = require("./performance");
const root_fixes = require("./root_fixes");
const {save_sgf, save_sgf_multi, tree_string} = require("./save_sgf");
const {fast_maxvisits, new_query} = require("./query");

const config_io = require("./config_io");

const {translate} = require("./translate");
const {node_id_from_search_id, valid_analysis_object, compare_versions, xy_to_s} = require("./utils");

const {NONE, AUTOANALYSIS, BACKANALYSIS, SELFPLAY, AUTOSCROLL, PLAY_BLACK, PLAY_WHITE} = require("./enums");

// ------------------------------------------------------------------------------------------------

function init() {

	let hub_prototype = {};
	Object.assign(hub_prototype, hub_main_props);
	Object.assign(hub_prototype, require("./hub_settings"));

	let eng;
	if (config.gtp_filepath) {
		eng = new_gtp_engine();
		eng.setup_with_command(config.gtp_filepath, config.gtp_argslist);
	} else {
		eng = new_engine();
		eng.setup(config.engine, config.engineconfig, config.weights);
	}

	return Object.assign(Object.create(hub_prototype), {

		node: null,
		engine: eng,
		play_mode: NONE,			// Don't set this directly, call set_play_mode() - to inform main.js, and also note that
		autoscroll_fn_id: null,		// play_mode: NONE does not mean we aren't searching: ponder on/off is indicated by the
		pending_up_down: 0,			// state of engine.desired...
		dropped_inputs: 0,
		mouseover_time: 0,
		pending_mouseover_fn_id: null,

	});
}

let hub_main_props = {

	// Draw........................................................................................

	draw: function() {

		let s = this.mouse_point();
		let did_draw_pv = false;

		if (s) {
			if (config.mouseover_delay <= 0 || performance.now() - this.mouseover_time >= config.mouseover_delay * 1000) {
				did_draw_pv = board_drawer.draw_pv(this.node, s);
			}
		}

		let want_antiflicker = Boolean(this.engine.desired) && !this.playing_active_colour();

		if (!did_draw_pv) {
			board_drawer.draw_standard(this.node, want_antiflicker);
		}
	},

	// Tabs........................................................................................

	add_roots: function(new_roots) {

		if (new_roots.length === 0) {
			return;
		}

		// We might want to replace our current tab with the first new root...

		if (tabber.active_tab_is_last() || new_roots.length === 1) {
			if (!this.node || this.node.is_bare_root()) {
				let node = config.load_at_end ? new_roots[0].get_end() : new_roots[0];
				this.set_node(node, {bless: true});
				new_roots = new_roots.slice(1);
			}
		}

		if (new_roots.length === 0) {

			// We have replaced this.node, but not added any new tabs.
			// Redraw the thumbnail instantly. Not essential, but for that snappy feel...

			tabber.draw_active_tab(this.node);

		} else {

			// Add the roots to the end, then switch to the last one...

			let switch_tab_dom_id;

			for (let root of new_roots) {
				let node = config.load_at_end ? root.get_end() : root;
				switch_tab_dom_id = tabber.create_inactive_tab_at_end(node);
			}

			this.switch_tab_by_dom_id(switch_tab_dom_id);
			tabber.outer_div.scrollTop = tabber.outer_div.scrollHeight;

		}
	},

	switch_tab_by_dom_id: function(dom_id) {
		let switch_node = tabber.deactivate_node_activate_dom_id(this.node, dom_id);
		this.set_node(switch_node, {bless: true});
	},

	close_tab: function() {

		if (fullbox.is_visible || root_editor.is_visible || stderrbox.is_visible) {		// Close it instead...
			this.disable_specials_except();
			return;
		}

		let node_to_destroy = this.node;

		if (tabber.tabs.length === 1) {
			this.node = null;
			this.new_game(19, 19);
		} else {
			let node = tabber.close_active_tab();
			this.set_node(node, {bless: true});
		}

		node_to_destroy.destroy_tree();
	},

	// Saving......................................................................................

	save: function(filepath) {
		save_sgf(this.node, filepath);
		let root = this.node.get_root();
		root.filepath = filepath;
		root.save_ok = true;
	},

	save_fast: function() {
		let root = this.node.get_root();
		if (root.filepath && root.save_ok) {
			this.save(root.filepath);
		} else {
			ipcRenderer.send("save_as_required");
		}
	},

	save_collection: function(filepath) {
		let nodes = tabber.tab_node_list(this.node);
		save_sgf_multi(nodes, filepath);
	},

	// Loading.....................................................................................

	load_from_buffer: function(buf, type, filepath) {		// filepath is solely used so we can store it in the root; we have already loaded the buf.

		let load_results = null;

		if (type === "sgf") load_results = load_sgf(buf);
		if (type === "ngf") load_results = load_ngf(buf);
		if (type === "gib") load_results = load_gib(buf);
		if (type === "ugi") load_results = load_ugi(buf);

		if (load_results === null) {
			load_results = new_load_results();
			load_results.add_errors("load_from_buffer(): got no object");
		}

		if (filepath) {
			let roots = load_results.get_roots();
			for (let root of roots) {
				root.filepath = filepath;
			}
			if (roots.length === 1 && type === "sgf") {
				roots[0].save_ok = true;
			}
		}

		return load_results;
	},

	load_sgf_from_string: function(s) {
		if (typeof s !== "string") {
			return;
		}
		let buf = Buffer.from(s);
		let load_results = this.load_from_buffer(buf, "sgf", "");
		this.finish_load(load_results);
	},

	load_multifile: function(...args) {			// Tolerates whatever combination of arrays and strings are sent...

		let arr = args.flat(Infinity);

		if (arr.length === 0) {
			return;
		}

		let load_results = new_load_results();

		for (let n = 0; n < arr.length; n++) {

			let filepath = arr[n];

			// This function is called with args from argv on startup, so might contain some nonsense... (though we slice out the app itself)

			if (filepath.endsWith(".exe") || filepath === __dirname || filepath === "." || filepath === "--allow-file-access-from-files") {
				continue;
			}

			if (!fs.existsSync(filepath)) {
				continue;
			}

			let buf;
			try {
				buf = fs.readFileSync(filepath);
			} catch (err) {
				load_results.add_errors(err);
				continue;
			}

			let type = "sgf";
			if (filepath.toLowerCase().endsWith(".ngf")) type = "ngf";
			if (filepath.toLowerCase().endsWith(".gib")) type = "gib";
			if (filepath.toLowerCase().endsWith(".ugi")) type = "ugi";
			if (filepath.toLowerCase().endsWith(".ugf")) type = "ugi";							// .ugf is the same as .ugi I think.

			let o = this.load_from_buffer(buf, type, filepath);
			load_results.absorb(o);
		}

		this.finish_load(load_results);
	},

	finish_load: function(load_results) {
		for (let root of load_results.get_roots()) {
			root_fixes.apply_all_fixes(root, config.guess_ruleset);
		}
		this.add_roots(load_results.get_roots());
		load_results.display_issues();
	},

	// Hidden / unused load functions..............................................................

	duplicate_tree: function() {
		let s = tree_string(this.node);
		this.load_sgf_from_string(s);
	},

	load_current_position: function() {
		let new_root = new_node();
		let old_root = this.node.get_root();
		for (let key of old_root.all_keys()) {
			if (key === "AB" || key === "AW" || key === "AE") continue;
			for (let value of old_root.all_values(key)) {
				new_root.add_value(key, value);
			}
		}
		let board = this.node.get_board();
		for (let x = 0; x < board.width; x++) {
			for (let y = 0; y < board.height; y++) {
				if (board.state[x][y] === "b") {
					new_root.add_value("AB", xy_to_s(x, y));
				} else if (board.state[x][y] === "w") {
					new_root.add_value("AW", xy_to_s(x, y));
				}
			}
		}
		if (board.active === "b") {
			new_root.set("PL", "B");
		} else {
			new_root.set("PL", "W");
		}
		this.add_roots([new_root]);
	},

	// New game....................................................................................

	new_game: function(width, height, komi, rules, handicap) {

		if (width === undefined) width = 19;
		if (height === undefined) height = 19;
		if (komi === undefined) komi = config.default_komi;
		if (rules === undefined) rules = config.default_rules;
		if (handicap === undefined) handicap = 0;

		if (width > 19 || height > 19) {
			throw new Error("new_game(): board sizes > 19 are not supported");
		}

		let root = new_node();

		root.set("GM", 1);
		root.set("FF", 4);
		root.set("CA", "UTF-8");

		if (width === height) {
			root.set("SZ", width);
		} else {
			root.set("SZ", `${width}:${height}`);
		}

		root.apply_handicap(handicap, config.tygem_3);

		root.set("RU", rules);
		root.set("KM", komi);

		this.add_roots([root]);
	},

	place_handicap: function(handicap) {

		let board = this.node.get_board();

		// Use current game if possible... we used to not do this but it had the problem that someone
		// could edit the game info and then place the handicap stones, which would either replace
		// the node (losing the info) or make a new tab, neither of which is desired...

		if (this.node.is_bare_root()) {				// Defined in node.js as no parent, no children, no AB, AW, B, W keys.
			this.node.forget_analysis();
			this.node.apply_handicap(handicap, config.tygem_3);
			this.node.change_id();					// Prevents the old query from updating the node.
			if (this.engine.desired) {
				this.go();
			}
			this.draw();
		} else {
			this.new_game(board.width, board.height, this.node.komi(), this.node.rules(), handicap);
		}
	},

	// Tree........................................................................................

	set_node: function(node, supplied_opts) {

		if (!node || node.destroyed) {
			throw new Error("set_node(): called with invalid node");
		}

		if (this.node === node) {
			return false;
		}

		// Of course, note that the early return means no graph draw or tree draw will be scheduled if it happens.

		let opts = {
			keep_selfplay: false,
			keep_autoanalysis: false,
			keep_play_colour: false,
			keep_autoscroll: false,
			bless: false						// Callers that leave this false do so because it's unneeded (would have no effect).
		};

		if (supplied_opts) Object.assign(opts, supplied_opts);		// I think this is Crockford's way of doing arguments to methods.

		// If we're going to be showing a different tree, need to update our root editor...

		if (!this.node || this.node.destroyed || this.node.get_root() !== node.get_root()) {
			root_editor.update_from_root(node.get_root());
		}

		// See whether the line end has changed, to decide if the graph needs a full redraw...

		let previous_line_end = (this.node && !this.node.destroyed) ? this.node.get_end() : null;

		// Set and maybe bless the node...

		this.node = node;

		if (opts.bless) {						// Do this after previous_line_end has been noted.
			this.node.bless();
		}

		// Figure out whether we want the engine to be running...

		let want_to_go = Boolean(this.engine.desired) || this.playing_active_colour();

		if (!opts.keep_selfplay && this.play_mode === SELFPLAY) {
			this.set_play_mode(NONE);
			want_to_go = false;
		}

		if (!opts.keep_autoanalysis && [AUTOANALYSIS, BACKANALYSIS].includes(this.play_mode)) {
			this.set_play_mode(NONE);
			want_to_go = false;
		}

		if (!opts.keep_play_colour && [PLAY_BLACK, PLAY_WHITE].includes(this.play_mode)) {
			this.set_play_mode(NONE);
			want_to_go = false;
		}

		if (!opts.keep_autoscroll && this.play_mode === AUTOSCROLL) {
			this.set_play_mode(NONE);
			// want_to_go = false;				// Not for this.
		}

		if (want_to_go) {
			this.go();
		} else {
			this.engine.halt();					// Don't use this.halt() which adjusts auto-stuff.
		}

		// Draw things...

		this.draw();							// Done after adjusting the engine, since draw() looks at what the engine is doing.

		if (previous_line_end !== this.node.get_end()) {
			grapher.draw_graph(this.node);
		} else {
			grapher.draw_position(this.node);
		}

		tree_drawer.must_draw = true;			// For reasons, this actually is responsible for calling disable_specials_except() to close special panes.
		comment_drawer.draw(this.node);
		comment_drawer.textarea.blur();

		return true;
	},

	add_pv: function() {						// Not sure if want. The end of the PV is poor quality.

		// We don't need to worry about what the relevant square (first move) is
		// because any PV that is actually being drawn is stored as board_drawer.pv

		if (board_drawer.pv) {

			let node = this.node;

			for (let s of board_drawer.pv) {
				if (s === "") {
					node = node.pass();
				} else {
					node = node.try_move(s);
				}
			}

			tree_drawer.must_draw = true;
		}
	},

	try_move: function(s) {						// Can't be used for passing.
		let node = this.node.try_move(s);		// Note node.try_move() returns the original node on failure.
		this.set_node(node, {keep_play_colour: true, bless: true});
	},

	pass: function() {
		let node = this.node.pass();
		this.set_node(node, {keep_play_colour: true, bless: true});
	},

	play_best: function(mode = "best") {
		if (this.node.has_valid_analysis()) {
			let s;
			if (mode === "best") {
				s = this.node.get_board().parse_gtp_move(this.node.analysis.moveInfos[0].move);
			} else if (mode === "policy") {
				s = this.node.best_policy_move();
			} else if (mode === "drunk") {
				s = this.node.drunk_policy_move();
			} else {
				throw new Error("play_best(): bad call");
			}
			if (typeof s !== "string") {
				return;
			} else if (s === "") {
				let node = this.node.pass();
				this.set_node(node, {keep_selfplay: true, keep_play_colour: true, bless: true});
			} else {
				let node = this.node.force_move(s);
				this.set_node(node, {keep_selfplay: true, keep_play_colour: true, bless: true});
			}
		}
	},

	play_top_policy: function() {
		this.play_best("policy");
	},

	play_drunk_policy: function() {
		this.play_best("drunk");
	},

	prev_auto: function() {
		if (this.node.parent) {
			this.set_node(this.node.parent, {keep_autoanalysis: true, bless: false});
		}
	},

	prev: function() {
		if (this.node.parent) {
			this.set_node(this.node.parent, {bless: false});
		}
	},

	backward: function(n) {
		if (this.node.parent) {
			this.set_node(this.node.backward_helper(n), {bless: false});
		}
	},

	next_auto: function() {
		if (this.node.children.length > 0) {
			this.set_node(this.node.get_blessed_child(), {keep_autoanalysis: true, keep_autoscroll: true, bless: false});
		}
	},

	next: function() {
		if (this.node.children.length > 0) {
			this.set_node(this.node.get_blessed_child(), {bless: false});
		}
	},

	forward: function(n) {
		if (this.node.children.length > 0) {
			this.set_node(this.node.forward_helper(n), {bless: false});
		}
	},

	go_to_root: function() {
		if (this.node.parent) {
			this.set_node(this.node.get_root(), {bless: false});
		}
	},

	go_to_end: function() {
		if (this.node.children.length > 0) {
			this.set_node(this.node.get_end(), {bless: false});
		}
	},

	prev_sibling: function() {
		let sib = this.node.greater_sibling();
		if (sib) {
			this.set_node(sib, {bless: true});
		}
	},

	next_sibling: function() {
		let sib = this.node.lesser_sibling();
		if (sib) {
			this.set_node(sib, {bless: true});
		}
	},

	return_to_main: function() {
		this.set_node(this.node.return_to_main_line_helper(), {bless: false});
		this.node.bless_main_line();
		grapher.draw_graph(this.node);
		tree_drawer.must_draw = true;
	},

	previous_fork: function() {
		this.set_node(this.node.previous_fork_helper(), {bless: false});
	},

	next_fork: function() {
		this.set_node(this.node.next_fork_helper(), {bless: false});
	},

	promote_to_main_line: function(include_descendants) {

		let node = include_descendants ? this.node.get_end() : this.node;

		while (node.parent) {
			if (node.parent.children[0] !== node) {
				for (let n = 1; n < node.parent.children.length; n++) {
					if (node.parent.children[n] === node) {
						node.parent.children[n] = node.parent.children[0];
						node.parent.children[0] = node;
						break;
					}
				}
			}
			node = node.parent;
		}

		grapher.draw_graph(this.node);
		tree_drawer.must_draw = true;
	},

	promote: function(include_descendants) {

		let node = include_descendants ? this.node.get_end() : this.node;

		while (node.parent) {
			if (node.parent.children[0] !== node) {
				for (let n = 1; n < node.parent.children.length; n++) {
					if (node.parent.children[n] === node) {
						let swapper = node.parent.children[n - 1];
						node.parent.children[n - 1] = node;
						node.parent.children[n] = swapper;
						break;
					}
				}
				break;		// 1 tree change only
			}
			node = node.parent;
		}

		grapher.draw_graph(this.node);					// In case we became the main line, in which case colours need updated.
		tree_drawer.must_draw = true;
	},

	delete_node: function() {
		if (this.node.parent) {
			let parent = this.node.parent;
			this.node.detach();
			this.set_node(parent, {bless: false});
		} else {										// There are good reasons why the root node can't be replaced.
			if (this.node.children.length > 0) {
				this.node.detach_children();
				this.draw();							// Clear the next move markers.
				grapher.draw_graph(this.node);
				tree_drawer.must_draw = true;
			}
			this.node.save_ok = false;
		}
	},

	delete_other_lines: function(include_descendants) {

		let node = include_descendants ? this.node.get_end() : this.node;

		while (node.parent) {
			node.detach_siblings();
			node = node.parent;
		}

		this.draw();									// I guess, because next move markers may need cleared.
		grapher.draw_graph(this.node);
		tree_drawer.must_draw = true;
	},

	forget_analysis_tree: function() {
		this.halt();
		this.node.forget_analysis_tree();
		this.node.change_id();							// Prevents the old query from updating the node.
		this.draw();
	},

	// Engine......................................................................................

	receive_object: function(o) {

		if (o.action === "query_version") {				// The board_drawer displays a startup message until the
			this.draw();								// query_version message arrives, so we should now draw()
			return;										// to remove it.
		}

		if (!valid_analysis_object(o)) {
			return;
		}

		let initial_draw_count = board_drawer.draw_count;
		let relevant_node_id = node_id_from_search_id(o.id);
		let policy_or_drunk = config.play_against_policy || config.play_against_drunk;		// Are either of these options set?

		if (relevant_node_id === this.node.id) {

			this.node.receive_analysis(o);

			// Stuff we can do with any result at all for this node...

			if (policy_or_drunk && this.playing_active_colour()) {

				this.engine.halt();						// Can't use this.halt() which turns off all auto-stuff
				if (config.play_against_drunk) {
					this.play_drunk_policy();
				} else  {
					this.play_top_policy();
				}

			} else if (policy_or_drunk && this.play_mode === SELFPLAY) {

				if (this.node.parent && this.node.parent.has_pass() && this.node.has_pass()) {		// Already had 2 passes, incoming move is 3rd (maybe).
					this.halt();
				} else {
					if (config.play_against_drunk) {
						this.play_drunk_policy();
					} else {
						this.play_top_policy();
					}
				}

			} else if (o.rootInfo.visits >= config.autoanalysis_visits) {

				// This object has enough visits to advance the position if we're in any special mode...

				if (this.playing_active_colour()) {

					this.engine.halt();					// Can't use this.halt() which turns off all auto-stuff
					this.play_best();

				} else if (this.play_mode === AUTOANALYSIS) {

					if (this.node.children.length > 0) {
						this.next_auto();
					} else {
						this.halt();
					}

				} else if (this.play_mode === BACKANALYSIS) {

					if (this.node.parent) {
						this.prev_auto();
					} else {
						this.halt();
					}

				} else if (this.play_mode === SELFPLAY) {

					if (this.node.parent && this.node.parent.has_pass() && this.node.has_pass()) {		// Already had 2 passes, incoming move is 3rd (maybe).
						this.halt();
					} else {
						this.play_best();
					}
				}
			}

			if (board_drawer.draw_count === initial_draw_count) {		// Nothing we did above fired draw(), so we must.
				this.draw();
			}

		} else if (this.node.parent && relevant_node_id === this.node.parent.id && ![SELFPLAY, PLAY_BLACK, PLAY_WHITE].includes(this.play_mode)) {

			// We received info for the parent node, which commonly happens when advancing forwards. It's
			// OK to set this info in the parent, unless we're in selfplay mode, in which case it's better
			// to leave the analysis that actually triggered the move.

			this.node.parent.receive_analysis(o);

		} else if (this.node.children.length > 0 && relevant_node_id === this.node.get_blessed_child().id) {

			// We received info for the blessed child node, which commonly happens when going backwards.

			this.node.get_blessed_child().receive_analysis(o);

		}
	},

	go: function() {
		this.disable_specials_except("comment_drawer");
		let policy_or_drunk = config.play_against_policy || config.play_against_drunk;
		if ([AUTOANALYSIS, BACKANALYSIS].includes(this.play_mode)) {
			this.engine.analyse(this.node, config.autoanalysis_visits);
		} else if (this.play_mode === SELFPLAY) {
			if (policy_or_drunk) {
				this.engine.analyse(this.node, fast_maxvisits);
			} else {
				this.engine.analyse(this.node, config.autoanalysis_visits);
			}
		} else if (this.playing_active_colour()) {
			if (policy_or_drunk) {
				this.engine.analyse(this.node, fast_maxvisits);
			} else {
				this.engine.analyse(this.node, config.autoanalysis_visits);
			}
		} else {
			this.engine.analyse(this.node);
		}
	},

	go_by_user: function() {
		if (![NONE, AUTOSCROLL].includes(this.play_mode)) {
			this.set_play_mode(NONE);
		}
		this.go();
	},

	// - NOTES ON GO / HALT:
	// - go() does not change play_mode, but go_by_user() does.
	// - Both halt() and halt_by_user() will change the play_mode.
	// - If we want to halt the engine without changing the play_mode, call engine.halt() instead.

	halt: function() {							// Note: if the adjustments to play_mode aren't wanted, just call engine.halt() directly.
		if (![NONE, AUTOSCROLL].includes(this.play_mode)) {
			this.set_play_mode(NONE);
		}
		this.engine.halt();
	},

	halt_by_user: function() {					// Exists so draw() can be called if needed. Note that various things that call halt()
		this.halt();							// do a draw(), so we can't just put the test in halt() if we want to avoid redundant draws.
		if (config.candidate_moves && config.no_ponder_no_candidates) {
			this.draw();
		}
	},

	toggle_ponder: function() {					// Only called when user does this.

		if (![NONE, AUTOSCROLL].includes(this.play_mode)) {
			this.set_play_mode(NONE);
		}
		if (this.engine.desired) {
			this.halt_by_user();
		} else {
			this.go();
		}
	},

	set_play_mode: function(val) {

		const menus = {
			[NONE]:         null,
			[AUTOANALYSIS]: [translate("MENU_ANALYSIS"), translate("MENU_AUTOANALYSIS")],
			[BACKANALYSIS]: [translate("MENU_ANALYSIS"), translate("MENU_BACKWARD_ANALYSIS")],
			[SELFPLAY]:     [translate("MENU_ANALYSIS"), translate("MENU_SELF_PLAY")],
			[AUTOSCROLL]:   [translate("MENU_MISC"), translate("MENU_AUTOSCROLL")],
			[PLAY_BLACK]:   [translate("MENU_MISC"), translate("MENU_ENGINE_PLAYS_BLACK")],
			[PLAY_WHITE]:   [translate("MENU_MISC"), translate("MENU_ENGINE_PLAYS_WHITE")],
		};

		if (this.play_mode === val) {
			return;
		}

		let menu = menus[this.play_mode];				// Clear check mark for the mode that's ending.
		if (menu) {
			ipcRenderer.send("set_check_false", menu);
		}
		menu = menus[val];										// Add check mark for the mode that's starting.
		if (menu) {
			ipcRenderer.send("set_check_true", menu);
		}

		this.play_mode = val;
	},

	toggle_autoanalysis: function() {
		if (this.play_mode === AUTOANALYSIS) {
			this.set_play_mode(NONE);
			this.engine.halt();
		} else {
			this.set_play_mode(AUTOANALYSIS);
			this.go();
		}
	},

	toggle_backanalysis: function() {
		if (this.play_mode === BACKANALYSIS) {
			this.set_play_mode(NONE);
			this.engine.halt();
		} else {
			this.set_play_mode(BACKANALYSIS);
			this.go();
		}
	},

	toggle_selfplay: function() {
		if (this.play_mode === SELFPLAY) {
			this.set_play_mode(NONE);
			this.engine.halt();
		} else {
			this.set_play_mode(SELFPLAY);
			this.go();
		}
	},

	toggle_autoscroll: function() {
		if (this.play_mode === AUTOSCROLL) {
			this.set_play_mode(NONE);
		} else {
			this.set_play_mode(AUTOSCROLL);
			if (this.engine.desired) {				// In the case where we switched from SELFPLAY to AUTOSCROLL, the
				this.go();							// query will have low maxVisits, so we need to restart it.
			}
		}
	},

	start_play_colour: function(val) {
		if (!val) {
			val = this.node.get_board().active;
		}
		if (val === "b") {
			this.set_play_mode(PLAY_BLACK);
		} else if (val === "w") {
			this.set_play_mode(PLAY_WHITE);
		} else {
			throw new Error("start_play_colour(): bad call");
		}
		if (this.playing_active_colour()) {
			this.go();
		}
	},

	clear_cache: function() {

		if (this.engine.is_gtp) {

			if (this.engine.known_commands.includes("clear_cache")) {
				this.engine.__send("clear_cache");
			} else {
				alert("Not available for this GTP engine.");
			}

		} else {

			if (compare_versions(this.engine.version, [1,9,0]) === -1) {
				alert("Not supported by this version of KataGo.");
				return;
			}

			this.halt();

			this.engine.__send({
				id: "clear_cache",			// Think this id doesn't matter.
				action: "clear_cache"
			});
		}
	},

	start_engine: function() {
		if (this.engine.exe || this.engine.has_quit) {
			this.halt();
			this.engine.shutdown();
			this.engine = config.gtp_filepath ? new_gtp_engine() : new_engine();
		}
		stderrbox.reset();
		if (config.gtp_filepath) {
			this.engine.setup_with_command(config.gtp_filepath, config.gtp_argslist);
		} else {
			this.engine.setup(config.engine, config.engineconfig, config.weights);		// Won't do anything unless all 3 are valid.
		}
		this.draw();
	},

	// Fullbox and similar.........................................................................

	about: function(name, version) {
		fullbox.about(name, version);
	},

	display_props: function(rootflag) {
		fullbox.display_node_props(rootflag ? this.node.get_root() : this.node);
	},

	display_root_editor: function() {
		root_editor.show();
	},

	display_stderr: function() {
		stderrbox.show();
	},

	escape: function() {
		this.disable_specials_except();
		if (config.editing !== "") {
			this.set("editing", "");
		}
	},

	performance: function() {
		let stats = make_perf_report(this.node);
		if (stats.B.moves_analysed < 1 || stats.W.moves_analysed < 1) {
			alert("Needs more analysis.");
		} else {
			fullbox.display_perf_report(stats);
		}
	},

	disable_specials_except: function(...args) {
		if (!args.includes("comment_drawer")) comment_drawer.textarea.blur();
		if (!args.includes("fullbox")) fullbox.hide();
		if (!args.includes("stderrbox")) stderrbox.hide();
		if (!args.includes("root_editor")) root_editor.hide();
	},

	// Misc........................................................................................

	playing_active_colour: function() {
		return (this.play_mode === PLAY_BLACK && this.node.get_board().active === "b") ||
		       (this.play_mode === PLAY_WHITE && this.node.get_board().active === "w");
	},

	redraw_if_desired_square_size_mismatch: function() {
		let desired = board_drawer.desired_square_size(this.node.get_board().width, this.node.get_board().height, config.coordinates);
		if (board_drawer.square_size !== desired) {
			this.draw();
			grapher.draw_graph(this.node);
		}
	},

	quit: function() {
		this.engine.shutdown();
		config_io.save();					// As long as we use the sync save, this will complete before we
		ipcRenderer.send("terminate");		// send "terminate". Not sure about results if that wasn't so.
	},

	log: function(...args) {
		console.log(...args);
	},

	commit_comment: function() {
		let s = comment_drawer.textarea.value.trim();
		if (s) {
			this.node.set("C", s);
		} else {
			this.node.delete_key("C");
		}
	},

	commit_root_edit: function(key) {
		let root = this.node.get_root();
		let value = root_editor.forms[key].value.trim();
		if (value) {
			root.set(key, value);
		} else {
			root.delete_key(key);
		}
	},

	delete_markup: function() {
		this.node.delete_markup();
		this.draw();
	},

	reset_mismatch_warnings: function() {
		this.node.reset_mismatch_warnings();
	},

	english_history: function() {			// For debugging and such, not used otherwise.
		let q = new_query(this.node);
		console.log(q.moves.map(foo => foo[1]).join(" "));
	},

	autoscroller: function() {

		// This is a spinner, always running.
		//
		// We store autoscroll_fn_id in case the config.autoscroll_delay is changed, in which
		// case we need to cancel the previously existing setTimeout and make a new one.
		// That is handled in hub_settings.js

		if (typeof config.autoscroll_delay !== "number" || config.autoscroll_delay < 0.25) {
			config.autoscroll_delay = 0.25;
		}

		if (this.play_mode === AUTOSCROLL) {
			if (this.node.children.length > 0) {
				this.next_auto();
			} else {
				this.set_play_mode(NONE);
			}
		}

		this.autoscroll_fn_id = setTimeout(this.autoscroller.bind(this), config.autoscroll_delay * 1000);
	},

	// Komi / rules / active can be changed easily.................................................

	coerce_rules: function(value) {
		this.node.get_root().set("RU", value);
		if (this.engine.desired) {
			this.go();
		}
		this.draw();
	},

	coerce_komi: function(value) {
		this.node.get_root().set("KM", value);
		if (this.engine.desired) {
			this.go();
		}
		this.draw();
	},

	toggle_active_player: function() {
		this.node.forget_analysis();
		this.node.toggle_player_to_move();	// May add or remove a PL tag in the current node.
		this.node.change_id();				// Prevents the old query from updating the node.
		if (this.engine.desired) {
			this.go();
		}
		this.draw();
	},

	// Clickers in the infobox.....................................................................

	cycle_rules: function(reverse) {

		const values = ["Chinese", "Japanese", "Stone Scoring"];

		let current = this.node.rules();

		let si = values.indexOf(current) + (reverse ? -1 : 1);
		if (si >= values.length) si = 0;
		if (si < 0) si = values.length - 1;

		this.coerce_rules(values[si]);
	},

	cycle_komi: function(reverse) {					// Relies on config.komi_options being sorted.

		let komi = this.node.komi();

		if (reverse) {
			for (let i = config.komi_options.length - 1; i >= 0; i--) {
				if (config.komi_options[i] < komi) {
					this.coerce_komi(config.komi_options[i]);
					return;
				}
			}
		} else {
			for (let i = 0; i < config.komi_options.length; i++) {
				if (config.komi_options[i] > komi) {
					this.coerce_komi(config.komi_options[i]);
					return;
				}
			}
		}

		// If we get here, we need to wrap...

		if (reverse) {
			this.coerce_komi(config.komi_options[config.komi_options.length - 1]);
			return;
		} else {
			this.coerce_komi(config.komi_options[0]);
			return;
		}

	},

	cycle_editing: function(reverse) {

		const values = ["AB", "AW", "AE", "TR", "SQ", "CR", "MA", "LB:A", "LB:1"];

		let current = config.editing;

		let si = values.indexOf(current);

		if (si === -1) {
			si = 0;
		} else {
			si += (reverse ? -1 : 1);
			if (si >= values.length) {
				si = 0;
			}
			if (si < 0) {
				si = values.length - 1;
			}
		}

		this.set("editing", values[si]);
	},

	cycle_numbers: function(reverse) {

		const values = [
			"Winrate + Visits",
			"LCB + Visits",
			"Score + Visits",
			"Delta + Visits",
			"Winrate",
			"LCB",
			"Score",
			"Delta",
			"Visits",
			"Visits (%)",
			"Order",
			"Policy",
			"Winrate + Visits + Score",
			"LCB + Visits + Score",
		];

		if (!config.candidate_moves) {
			this.set("candidate_moves", true);
			return;
		}

		if (config.no_ponder_no_candidates && !this.engine.desired) {
			this.set("no_ponder_no_candidates", false);
			return;
		}

		let current = config.numbers;

		let si = values.indexOf(current);

		if (si === -1) {
			si = 0;
		} else {
			si += (reverse ? -1 : 1);
			if (si >= values.length) {
				si = 0;
			}
			if (si < 0) {
				si = values.length - 1;
			}
		}

		this.set("numbers", values[si]);
	},

	// Mouse.......................................................................................

	click: function(s, event) {
		if (!config.editing) {
			this.try_move(s);
		} else if (["TR", "SQ", "CR", "MA"].includes(config.editing)) {
			if (event.shiftKey || event.ctrlKey) {
				this.node.toggle_shape_at_group(config.editing, s);
			} else {
				this.node.toggle_shape_at(config.editing, s);
			}
			this.draw();
		} else if (config.editing === "LB:A") {
			this.node.toggle_alpha_at(s);
			this.draw();
		} else if (config.editing === "LB:1") {
			this.node.toggle_number_at(s);
			this.draw();
		} else if (["AB", "AW", "AE"].includes(config.editing)) {
			this.halt();
			let key = config.editing;
			if (event.button === 2 && key !== "AE") {
				// When user right click with Add Black or Add White, use the other colour instead.
				key = (key === "AB") ? "AW" : "AB";
			}
			if (this.node.safe_to_edit()) {
				this.node.forget_analysis();
				this.node.apply_board_edit(key, s);
				this.node.change_id();							// Prevents the old query from updating the node. Prevents tabber from skipping its draw.
				this.draw();
			} else {
				let node = new_node(this.node);
				node.apply_board_edit(key, s);
				this.set_node(node, {bless: true});
			}
		}
	},

	mouse_point: function() {
		let overlist = document.querySelectorAll(":hover");
		for (let item of overlist) {
			if (typeof item.className === "string") {
				let classes = item.className.split(" ");
				for (let c of classes) {
					if (c.startsWith("td_")) {
						return c.slice(3);
					}
				}
			}
		}
		return null;
	},

	mouse_entering_point: function(s) {									// Called when mouse has entered some point e.g. "jj" or sometimes null

		this.mouseover_time = performance.now();

		if (config.mouseover_delay <= 0) {

			// No delay set, so instantly draw the PV if possible.
			// Otherwise draw standard if needed to clear an old PV being shown.

			let did_draw_pv = board_drawer.draw_pv(this.node, s);

			if (board_drawer.pv && !did_draw_pv) {						// We didn't draw a PV yet one is being displayed, meaning it's old.
				board_drawer.draw_standard(this.node);
			}

		} else {

			// Draw standard if needed to clear an old PV being shown.
			// Create a setTimeout() to draw a new PV in a moment.

			if (board_drawer.pv) {
				board_drawer.draw_standard(this.node);
			}

			if (this.pending_mouseover_fn_id) {							// Cancel any such timeout already pending.
				clearTimeout(this.pending_mouseover_fn_id);
				this.pending_mouseover_fn_id = null;
			}

			if (s) {
				this.pending_mouseover_fn_id = setTimeout(() => {
					this.pending_mouseover_fn_id = null;
					if (this.mouse_point() === s && !board_drawer.pv) {
						board_drawer.draw_pv(this.node, s);				// Might fail / refuse. We don't care.
					}
				}, config.mouseover_delay * 1000);
			}
		}
	},

	// Moving up / down the tree might create a pileup of events (maybe?) so we buffer them........

	input_up_down: function(n) {
		if (this.pending_up_down !== 0) {
			this.dropped_inputs++;
		}
		this.pending_up_down = n;		// We could consider adjusting by n rather than replacing.
	},

};



module.exports = init();
