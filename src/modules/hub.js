"use strict";

const fs = require("fs");
const {ipcRenderer} = require("electron");

const new_engine = require("./engine");
const new_node = require("./node");

const load_gib = require("./load_gib");
const load_ngf = require("./load_ngf");
const load_sgf = require("./load_sgf");
const {save_sgf, save_sgf_multi, tree_string} = require("./save_sgf");

const config_io = require("./config_io");
const {set_title} = require("./title");
const {handicap_stones, node_id_from_search_id, valid_analysis_object, compare_versions} = require("./utils");

// ------------------------------------------------------------------------------------------------

function init() {

	let hub_prototype = {};
	Object.assign(hub_prototype, hub_main_props);
	Object.assign(hub_prototype, require("./hub_settings"));

	let eng = new_engine();

	if (config.arbitrary_command) {
		eng.setup_with_command(config.arbitrary_command, config.arbitrary_argslist);
	} else {
		eng.setup(config.engine, config.engineconfig, config.weights);
	}

	return Object.assign(Object.create(hub_prototype), {

		node: null,
		engine: eng,

		__autoanalysis: false,			// Don't set this directly, because main.js needs informed too
		__autoplay: false,				// Don't set this directly, because main.js needs informed too
		__play_colour: null,			// Don't set this directly, because main.js needs informed too

		pending_up_down: 0,
		dropped_inputs: 0,

	});
}

let hub_main_props = {

	// Draw........................................................................................

	draw: function() {
		let s = this.mouse_point();
		if (s) {
			if (board_drawer.draw_pv(this.node, s)) {				// true iff this actually happened.
				return;
			}
		}
		board_drawer.draw_standard(this.node);
	},

	update_title: function() {
		let title_text = this.node.game_title_text();
		if (title_text) {
			set_title(title_text);
		} else {
			set_title("Ogatak");
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

			// If were were just replacing a node and adding nothing else, draw its tab etc...

			tabber.draw_active_tab(this.node);
			this.update_title();

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
		this.update_title();
	},

	close_tab: function() {

		if (fullbox.is_visible) {		// If the fullbox is open, close it instead...
			fullbox.hide();
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
		this.update_title();

		node_to_destroy.destroy_tree();
	},

	// Saving and loading .........................................................................

	save: function(filepath) {
		save_sgf(this.node, filepath);
		let root = this.node.get_root();
		root.filepath = filepath;
		root.save_ok = true;
		this.update_title();
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

	get_roots_from_buffer: function(buf, type, filepath) {		// filepath is solely used so we can store it in the root; we have already loaded the buf.

		let new_roots = [];

		// The loaders all either throw or return a length >= 1 array...

		if (type === "sgf") new_roots = load_sgf(buf);
		if (type === "ngf") new_roots = load_ngf(buf);
		if (type === "gib") new_roots = load_gib(buf);

		if (new_roots.length === 0) {
			throw new Error("get_roots_from_buffer(): got a zero length array of roots, this is supposed to be impossible");
		}

		if (filepath) {
			for (let root of new_roots) {
				root.filepath = filepath;
			}
			if (new_roots.length === 1 && type === "sgf") {
				new_roots[0].save_ok = true;
			}
		}

		return new_roots;
	},

	load_sgf_from_string: function(s) {

		if (typeof s !== "string") {
			return;
		}

		try {

			let buf = Buffer.from(s);
			let new_roots = this.get_roots_from_buffer(buf, "sgf", "");			// Can throw (or the things it calls can).

			let ok_roots = new_roots.filter(z => z.width() <= 19 && z.height() <= 19);

			if (ok_roots.length !== new_roots.length) {
				if (ok_roots.length === 0) {
					alert("Board sizes > 19 are not supported.");
				} else {
					alert("Some games in the collection were not loaded because they have size > 19.");
					this.add_roots(ok_roots);
				}
			} else {
				this.add_roots(ok_roots);
			}

		} catch (err) {
			alert(err.toString());
		}
	},

	load_multifile: function(...args) {		// Tolerates whatever combination of arrays and strings are sent...

		let arr = args.flat(Infinity);

		if (arr.length === 0) {
			return;
		}

		let new_roots = [];
		let loader_errors = [];

		for (let n = 0; n < arr.length; n++) {

			let filepath = arr[n];

			// This function is called with args from argv on startup, so might contain some nonsense... (though we slice out the app itself)

			if (filepath.endsWith(".exe") || filepath === __dirname || filepath === "." || filepath === "--allow-file-access-from-files") {
				continue;
			}

			if (!fs.existsSync(filepath)) {
				continue;
			}

			try {

				let buf = fs.readFileSync(filepath);

				let type = "sgf";
				if (filepath.toLowerCase().endsWith(".ngf")) type = "ngf";
				if (filepath.toLowerCase().endsWith(".gib")) type = "gib";

				new_roots = new_roots.concat(this.get_roots_from_buffer(buf, type, filepath));		// Can throw (or the things it calls can).

			} catch (err) {
				loader_errors.push(err);
				continue;
			}
		}

		let ok_roots = new_roots.filter(z => z.width() <= 19 && z.height() <= 19);

		if (ok_roots.length !== new_roots.length) {
			if (ok_roots.length === 0) {
				loader_errors.push("Board sizes > 19 are not supported.");
			} else {
				loader_errors.push("Some games in the collection were not loaded because they have size > 19.");
			}
		}

		if (loader_errors.length > 1) {
			alert("Some errors occurred while loading these files.");
		} else if (loader_errors.length === 1) {
			alert(loader_errors[0].toString());
		}

		this.add_roots(ok_roots);
	},

	duplicate_tree: function() {
		let s = tree_string(this.node);
		this.load_sgf_from_string(s);
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

		let points = handicap_stones(handicap, width, height, false);
		for (let point of points) {
			root.add_value("AB", point);
		}
		if (points.length > 1) {
			root.set("HA", points.length);
		}

		root.set("RU", rules);
		root.set("KM", komi);

		this.add_roots([root]);
	},

	place_handicap: function(handicap) {
		let board = this.node.get_board();
		this.new_game(board.width, board.height, board.komi, board.rules, handicap);
	},

	// Tree........................................................................................

	set_node: function(node, supplied_opts) {

		if (!node || node.destroyed) {
			throw new Error("set_node(): called with invalid node");
		}

		if (this.node === node) {				// A few things can call set_node() with the same node that's currently
			fullbox.hide();						// active, in which case we do nothing important. But we likely want to
			return false;						// close the fullbox, if it's open.
		}

		comment_drawer.textarea.blur();

		// Of course, note that the early return means no graph draw or tree draw will be scheduled if it happens.

		let opts = {
			keep_autoplay_settings: false,
			bless: false						// When a caller leaves this as false, it's just because it isn't necessary.
		};

		if (supplied_opts) Object.assign(opts, supplied_opts);		// I think this is Crockford's way of doing arguments to methods.

		let previous_line_end = (this.node && !this.node.destroyed) ? this.node.get_end() : null;

		this.node = node;

		if (opts.bless) {						// Do this after previous_line_end has been noted.
			this.node.bless();
		}

		let want_to_go = this.engine.desired ? true : false;

		if (this.__play_colour) {
			want_to_go = this.__play_colour === this.node.get_board().active;
		}

		if (!opts.keep_autoplay_settings) {
			if (this.__autoanalysis || this.__autoplay || this.__play_colour) {
				this.set_autoanalysis(false);
				this.set_autoplay(false);
				this.set_play_colour(null);
				want_to_go = false;				// i.e. we halt only if we are turning off one of these things.
			}
		}

		if (want_to_go) {
			this.go();
		} else {
			this.engine.halt();					// Don't use this.halt() which adjusts auto-stuff.
		}

		this.draw();							// Done after adjusting the engine, since draw() looks at what the engine is doing.

		if (previous_line_end !== this.node.get_end()) {
			grapher.draw_graph(this.node);
		} else {
			grapher.draw_position(this.node);
		}

		tree_drawer.must_draw = true;
		comment_drawer.draw(this.node);

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
		this.set_node(node, {keep_autoplay_settings: true, bless: true});
	},

	pass: function() {
		let node = this.node.pass();
		this.set_node(node, {keep_autoplay_settings: true, bless: true});
	},

	play_best: function() {
		if (this.node.has_valid_analysis()) {
			let s = this.node.get_board().parse_gtp_move(this.node.analysis.moveInfos[0].move);
			if (!s) {
				this.pass();
			} else {
				let node = this.node.force_move(s);
				this.set_node(node, {keep_autoplay_settings: true, bless: true});
			}
		}
	},

	prev: function() {
		if (this.node.parent) {
			this.set_node(this.node.parent, {bless: false});
		}
	},

	next: function() {
		if (this.node.children.length > 0) {
			this.set_node(this.node.get_blessed_child(), {keep_autoplay_settings: true, bless: false});
		}
	},

	backward: function(n) {
		this.set_node(this.node.backward_helper(n), {bless: false});
	},

	forward: function(n) {
		this.set_node(this.node.forward_helper(n), {bless: false});
	},

	go_to_root: function() {
		this.set_node(this.node.get_root(), {bless: false});
	},

	go_to_end: function() {
		this.set_node(this.node.get_end(), {bless: false});
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

		grapher.draw_graph(this.node);							// In case we became the main line, in which case colours need updated.
		tree_drawer.must_draw = true;
	},

	delete_node: function() {
		if (this.node.parent) {
			let parent = this.node.parent;
			this.node.detach();
			this.set_node(parent, {bless: false});
		} else {												// There are good reasons why the root node can't be replaced.
			if (this.node.children.length > 0) {
				this.node.detach_children();
				this.draw();									// Clear the next move markers.
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

		this.draw();											// I guess, because next move markers may need cleared.
		grapher.draw_graph(this.node);
		tree_drawer.must_draw = true;
	},

	forget_analysis_tree: function() {
		this.halt();
		this.node.forget_analysis_tree();
		this.node.change_id();									// Prevents update from engine.
		this.draw();
	},

	// Engine......................................................................................

	receive_object: function(o) {

		if (!valid_analysis_object(o)) {
			return;
		}

		let relevant_node_id = node_id_from_search_id(o.id);

		if (relevant_node_id === this.node.id) {

			this.node.receive_analysis(o);

			if (o.rootInfo.visits > config.autoanalysis_visits) {

				if (this.__play_colour && this.__play_colour === this.node.get_board().active) {

					this.engine.halt();					// Can't use this.halt() which turns off all auto-stuff
					this.play_best();
					return;								// Just to avoid the redundant draw()

				} else if (this.__autoanalysis) {

					if (this.node.children.length > 0) {
						this.next();
						return;							// Just to avoid the redundant draw()
					} else {
						this.halt();
					}

				} else if (this.__autoplay) {

					if (this.node.parent && this.node.parent.has_pass() && this.node.has_pass()) {		// Already had 2 passes, incoming move is 3rd (maybe).
						this.halt();
					} else {
						this.play_best();
						return;							// Just to avoid the redundant draw()
					}
				}
			}

			this.draw();

		} else if (this.node.parent && relevant_node_id === this.node.parent.id && !this.__autoplay) {

			// We received info for the parent node, which commonly happens when advancing forwards. It's
			// OK to set this info in the parent, unless we're in autoplay mode, in which case it's better
			// to leave the analysis that actually triggered the move.

			this.node.parent.receive_analysis(o);

		} else if (this.node.children.length > 0 && relevant_node_id === this.node.get_blessed_child().id) {

			// We received info for the blessed child node, which commonly happens when going backwards.

			this.node.get_blessed_child().receive_analysis(o);

		}
	},

	go: function() {
		fullbox.hide();
		this.engine.analyse(this.node);
	},

	halt: function() {						// Note: if the adjustments to auto-stuff aren't wanted, just call engine.halt() directly.
		this.set_autoanalysis(false);
		this.set_autoplay(false);
		this.set_play_colour(null);
		this.engine.halt();
	},

	toggle_ponder: function() {
		this.set_autoanalysis(false);
		this.set_autoplay(false);
		this.set_play_colour(null);
		if (this.engine.desired) {
			this.halt();
		} else {
			this.go();
		}
	},

	set_autoanalysis: function(val) {

		val = val ? true : false;

		if (this.__autoanalysis !== val) {
			this.__autoanalysis = val;
			ipcRenderer.send(val ? "set_check_true" : "set_check_false", ["Analysis", "Autoanalysis"]);
		}

		return val;
	},

	set_autoplay: function(val) {

		val = val ? true : false;

		if (this.__autoplay !== val) {
			this.__autoplay = val;
			ipcRenderer.send(val ? "set_check_true" : "set_check_false", ["Analysis", "Self-play"]);
		}

		return val;
	},

	set_play_colour: function(val) {

		val = (val === "b" || val === "w") ? val : null;

		if (this.__play_colour !== val) {
			this.__play_colour = val;
			ipcRenderer.send(val === "b" ? "set_check_true" : "set_check_false", ["Misc", "Play Black"]);
			ipcRenderer.send(val === "w" ? "set_check_true" : "set_check_false", ["Misc", "Play White"]);
		}

		return val;
	},

	start_autoanalysis: function() {
		this.set_autoanalysis(true);
		this.set_autoplay(false);
		this.set_play_colour(null);
		if (!this.engine.desired) {
			this.go();
		}
	},

	start_autoplay: function() {
		this.set_autoanalysis(false);
		this.set_autoplay(true);
		this.set_play_colour(null);
		if (!this.engine.desired) {
			this.go();
		}
	},

	start_play_colour: function(val) {
		this.set_autoanalysis(false);
		this.set_autoplay(false);
		this.set_play_colour(val);
		if (!this.engine.desired && this.node.get_board().active === val) {
			this.go();
		}
	},

	clear_cache: function() {

		if (compare_versions(this.engine.version, [1,9,0]) === -1) {
			alert("Not supported by this version of KataGo.");
			return;
		}

		this.halt();

		this.engine.__send({
			id: "clear_cache",			// Think this id doesn't matter.
			action: "clear_cache"
		});
	},

	maybe_start_engine: function() {	// This gets called only by hub_settings.js, and never if config.arbitrary_command exists.
		if (this.engine.exe || this.engine.has_quit) {
			this.halt();
			this.engine.shutdown();
			this.engine = new_engine();
		}
		this.engine.setup(config.engine, config.engineconfig, config.weights);		// Won't do anything unless all 3 are valid.
		this.draw();
	},

	restart_engine: function() {
		if (this.engine.exe || this.engine.has_quit) {
			this.halt();
			this.engine.shutdown();
			this.engine = new_engine();
		}
		if (config.arbitrary_command) {
			this.engine.setup_with_command(config.arbitrary_command, config.arbitrary_argslist);
		} else {
			this.engine.setup(config.engine, config.engineconfig, config.weights);
		}
		this.draw();
	},

	// Fullbox.....................................................................................

	about: function(name, version) {
		this.halt();
		fullbox.about(name, version);
	},

	display_props: function(rootflag) {
		this.halt();
		fullbox.display_node_props(rootflag ? this.node.get_root() : this.node);
	},

	escape: function() {
		comment_drawer.textarea.blur();
		if (fullbox.is_visible) {
			fullbox.hide();
		} else {
			this.set("mode", "");
		}
	},

	// Misc........................................................................................

	autoset_square_size: function() {
		let dy = window.innerHeight - board_drawer.canvas.getBoundingClientRect().top;
		let ss = Math.max(10, Math.floor((dy - 8) / 19));
		if (ss !== config.square_size) {
			this.set("square_size", ss);
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

	fix_go_halt_menu_item: function() {
		if (this.engine.desired) {
			ipcRenderer.send("set_check_true", ["Analysis", "Go / halt toggle"]);
		} else {
			ipcRenderer.send("set_check_false", ["Analysis", "Go / halt toggle"]);
		}
	},

	// Komi / rules / active are part of the board.................................................

	coerce_rules: function(value) {
		this.node.coerce_rules(value);		// Sets the rules in every board in the tree.
		if (this.engine.desired) {
			this.go();
		}
		this.draw();
	},

	coerce_komi: function(value) {
		this.node.coerce_komi(value);		// Sets the komi in every board in the tree.
		if (this.engine.desired) {
			this.go();
		}
		this.draw();
	},

	toggle_active_player: function() {		// Adds a PL tag to the current node.
		this.node.forget_analysis();
		this.node.toggle_player_to_move();
		this.node.change_id();				// Prevents the engine thinking the old query is still valid. Prevents the old query from updating the node.
		if (this.engine.desired) {
			this.go();
		}
		this.draw();
	},

	// Clickers in the infobox.....................................................................

	cycle_rules: function(reverse) {

		const values = ["Chinese", "Japanese", "Stone Scoring"];

		let current = this.node.get_board().rules;

		let si = values.indexOf(current) + (reverse ? -1 : 1);
		if (si >= values.length) si = 0;
		if (si < 0) si = values.length - 1;

		this.coerce_rules(values[si]);
	},

	cycle_komi: function(reverse) {

		let komi = this.node.get_board().komi;

		if (reverse) {
			komi -= 0.5;
		} else {
			komi += 0.5;
		}

		if (komi < 0) komi = 7.5;
		if (komi > 7.5) komi = 0;

		this.coerce_komi(komi);
	},

	cycle_mode: function(reverse) {

		const values = ["AB", "AW", "AE", "TR", "SQ", "CR", "MA", "LB:A", "LB:1"];

		let current = config.mode;

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

		this.set("mode", values[si]);
	},

	cycle_numbers: function(reverse) {

		const values = [
			"LCB + Visits",
			"Score + Visits",
			"Delta + Visits",
			"LCB",
			"Score",
			"Delta",
			"Visits",
			"Visits (%)",
			"Order",
			"Policy",
			"Winrate",
			"LCB + Visits + Score",
		];

		if (!config.candidate_moves) {
			this.set("candidate_moves", true);
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
		if (!config.mode) {
			this.try_move(s);
		} else if (["TR", "SQ", "CR", "MA"].includes(config.mode)) {
			if (event.shiftKey || event.ctrlKey) {
				this.node.toggle_shape_at_group(config.mode, s);
			} else {
				this.node.toggle_shape_at(config.mode, s);
			}
			this.draw();
		} else if (config.mode === "LB:A") {
			this.node.toggle_alpha_at(s);
			this.draw();
		} else if (config.mode === "LB:1") {
			this.node.toggle_number_at(s);
			this.draw();
		} else if (["AB", "AW", "AE"].includes(config.mode)) {
			this.halt();
			if (this.node.safe_to_edit()) {
				this.node.forget_analysis();
				this.node.apply_board_edit(config.mode, s);
				this.node.change_id();							// Prevents stale analysis updates. Prevents tabber from skipping its draw.
				this.draw();
			} else {
				let node = new_node(this.node);
				node.apply_board_edit(config.mode, s);
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

	mouse_entering_point: function(s) {									// Called when mouse has entered some point e.g. "jj"

		// This returns true if a PV was drawn for the point s...

		if (board_drawer.draw_pv(this.node, s)) {
			return;
		}

		// We did not draw a PV, so if the last draw that actually happened was a PV, it
		// was for some other point, and we need to do a standard draw to hide it...

		if (board_drawer.pv) {
			board_drawer.draw_standard(this.node);
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
