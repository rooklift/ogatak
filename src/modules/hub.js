"use strict";

const fs = require("fs");
const path = require("path");
const {ipcRenderer} = require("electron");

const new_board_drawer = require("./board_drawer");
const new_comment_drawer = require("./comment_drawer");
const new_engine = require("./engine");
const new_grapher = require("./grapher");
const new_node = require("./node");
const new_tabber = require("./tabber");
const new_tree_drawer = require("./tree_drawer");

const load_gib = require("./load_gib");
const load_ngf = require("./load_ngf");
const load_sgf = require("./load_sgf");
const save_sgf = require("./save_sgf");

const config_io = require("./config_io");
const {get_title, set_title} = require("./title");
const {handicap_stones, node_id_from_search_id, xy_to_s, valid_analysis_object, compare_versions} = require("./utils");

// ------------------------------------------------------------------------------------------------

exports.new_hub = function() {

	let hub = Object.create({});

	Object.assign(hub, hub_props);
	Object.assign(hub, require("./hub_settings"));

	hub.maindrawer = new_board_drawer(
		document.getElementById("boardbg"),
		document.getElementById("boardtable"),
		document.getElementById("boardcanvas"),
		document.getElementById("boardinfo")
	);

	hub.grapher = new_grapher(
		document.getElementById("graphcanvas"),
		document.getElementById("graphpositioncanvas"),
		hub.maindrawer
	);

	hub.tree_drawer = new_tree_drawer(
		document.getElementById("treecanvas"),
		hub.grapher
	);

	hub.comment_drawer = new_comment_drawer(
		document.getElementById("comments")
	);

	hub.engine = new_engine();

	if (config.arbitrary_command) {
		hub.engine.setup_with_command(config.arbitrary_command, config.arbitrary_argslist);
	} else {
		hub.engine.setup(config.engine, config.engineconfig, config.weights);
	}

	hub.__autoanalysis = false;					// Don't set this directly, because it should be ack'd
	hub.__autoplay = false;						// Don't set this directly, because it should be ack'd
	hub.__play_colour = null;					// Don't set this directly, because it should be ack'd

	hub.tabber = new_tabber(
		document.getElementById("tabdiv")
	);

	hub.pending_up_down = 0;
	hub.dropped_inputs = 0;

	return hub;
};

let hub_props = {

	// Draw........................................................................................

	draw: function() {
		let s = this.mouse_point();
		if (s) {
			if (this.maindrawer.draw_pv(this.node, s)) {				// true iff this actually happened.
				return;
			}
		}
		this.maindrawer.draw_standard(this.node);
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

		let switch_index = null;

		for (let n = 0; n < new_roots.length; n++) {

			let root = new_roots[n];

			// It might be acceptable to make the first root overwrite the current node...

			let overwrite;

			if (!this.node) {
				overwrite = true;
			} else if (this.tabber.inactive_tab_exists(this.node)) {
				overwrite = false;
			} else if (n === 0 && !this.node.parent && this.node.children.length === 0 && (this.tabber.active_tab_is_last_tab() || new_roots.length === 1)) {
				overwrite = true;
			} else {
				overwrite = false;
			}

			let node = config.load_at_end ? root.get_end() : root;

			if (overwrite) {
				this.set_node(node, {bless: true});
			} else {
				switch_index = this.tabber.create_inactive_tab_at_end(node);
			}
		}

		if (switch_index !== null) {
			this.switch_tab(switch_index);
		} else {
			this.tabber.draw_active_tab(this.node);
			this.update_title();
		}
	},

	switch_tab: function(index) {
		if (index < 0 || index >= this.tabber.tabs.length) {
			return;
		}
		let switch_node = this.tabber.deactivate_node_activate_index(this.node, index);
		this.set_node(switch_node, {bless: true});
		this.tabber.draw_tabs(this.node);
		this.update_title();
	},

	new_active_view: function() {
		let index = this.tabber.create_inactive_tab_after_active(this.node);
		this.switch_tab(index);
	},

	new_active_view_try_move: function(s) {
		let index = this.tabber.create_inactive_tab_after_active(this.node.try_move(s));
		this.switch_tab(index);
	},

	close_tab: function() {

		let node_to_destroy = this.tabber.tree_exists_in_inactive_tabs(this.node) ? null : this.node;

		if (this.tabber.tabs.length === 1) {
			this.node = null;
			this.new_game(19, 19);
		} else {
			let node = this.tabber.close_active_tab();
			this.set_node(node, {bless: true});
		}
		this.tabber.draw_tabs(this.node);
		this.update_title();

		if (node_to_destroy) {
			node_to_destroy.destroy_tree();
		}

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

	get_roots_from_buffer: function(buf, type, filepath) {		// filepath is solely used so we can store it in the root; we have already loaded the buf.

		let new_roots = [];

		// The loaders all either throw or return a length >= 1 array...

		if (type === "sgf") new_roots = load_sgf(buf);
		if (type === "ngf") new_roots = load_ngf(buf);
		if (type === "gib") new_roots = load_gib(buf);

		if (new_roots.length === 0) {
			throw "got a zero length array of roots, this is supposed to be impossible";
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

	load_sgf_from_string: function (s) {

		if (typeof s !== "string") {
			return;
		}

		try {
			let buf = Buffer.from(s);
			let roots = this.get_roots_from_buffer(buf, "sgf", "");
			this.add_roots(roots);
		} catch (err) {
			console.log("load_sgf_from_string():", err);
			alert("While loading from string:\n" + err.toString());
		}
	},

	load_multifile(arr) {

		if (arr.length === 0) {
			return;
		}

		let new_roots = [];
		let got_actual_file = false;

		let loader_errors = [];

		for (let n = 0; n < arr.length; n++) {

			let filepath = arr[n];

			if (filepath === __dirname || filepath === ".") {		// Can happen when extra args are passed to main process. Silently ignore.
				continue;
			}

			if (got_actual_file === false) {						// The next test is maybe expensive (?) so only do it until we get to real files in the array.
				if (fs.existsSync(filepath) === false) {			// Can happen when extra args are passed to main process. Silently ignore.
					continue;
				}
			}

			try {

				let buf = fs.readFileSync(filepath);
				got_actual_file = true;

				let type = "sgf";
				if (filepath.toLowerCase().endsWith(".ngf")) type = "ngf";
				if (filepath.toLowerCase().endsWith(".gib")) type = "gib";

				new_roots = new_roots.concat(this.get_roots_from_buffer(buf, type, filepath));

			} catch (err) {
				loader_errors.push(err);
				continue;
			}
		}

		if (loader_errors.length > 1) {
			alert("Some errors occurred while loading these files.");
		} else if (loader_errors.length === 1) {
			alert("Load error:\n" + loader_errors[0].toString());
		}

		this.add_roots(new_roots);
	},

	// New game....................................................................................

	new_game: function(width, height) {

		let komi = this.node ? this.node.get_board().komi : config.default_komi;
		let rules = this.node ? this.node.get_board().rules : config.default_rules;

		if (rules === "Unknown") {
			rules = config.default_rules;
		}

		this.__new_game(width, height, komi, rules, 0);
	},

	__new_game: function(width, height, komi, rules, handicap) {

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
		this.__new_game(board.width, board.height, board.komi, board.rules, handicap);
	},

	// Tree........................................................................................

	set_node: function(node, supplied_opts) {

		if (!node || this.node === node) {
			return false;
		}

		let opts = {
			keep_autoplay_settings: false,
			full_graph_draw: false,				// Beware: these actions won't be taken if node === this.node
			bless: false						// as the function has already returned (see above).
		};

		if (supplied_opts) Object.assign(opts, supplied_opts);

		// The above is I think Crockford's way of doing arguments to methods.

		this.node = node;

		if (opts.bless) {
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

		if (opts.full_graph_draw) {
			this.grapher.draw_graph(this.node);
		} else if (this.grapher.line_end && node.get_end() !== this.grapher.line_end.get_end()) {		// get_end() because maybe gained descendents
			this.grapher.draw_graph(this.node);
		} else {
			this.grapher.draw_position(this.node);
		}

		this.tree_drawer.must_draw = true;

		this.comment_drawer.draw(this.node);

		return true;
	},

	try_move: function(s) {
		let node = this.node.try_move(s);
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

		this.node.bless_main_line();				// Done before set_node() so that it draws the correct graph.

		let ok = this.set_node(this.node.return_to_main_line_helper(), {full_graph_draw: true, bless: false});

		if (!ok) {									// set_node() returned instantly, so we gotta draw graph and tree...
			this.grapher.draw_graph(this.node);
			this.tree_drawer.must_draw = true;
		}
	},

	previous_fork: function() {
		this.set_node(this.node.previous_fork_helper(), {bless: false});
	},

	next_fork: function() {
		this.set_node(this.node.next_fork_helper(), {bless: false});
	},

	promote_to_main_line: function(suppress_draw) {

		let node = this.node.get_end();
		let changed = false;

		while (node.parent) {
			if (node.parent.children[0] !== node) {
				for (let n = 1; n < node.parent.children.length; n++) {
					if (node.parent.children[n] === node) {
						node.parent.children[n] = node.parent.children[0];
						node.parent.children[0] = node;
						changed = true;
						break;
					}
				}
			}
			node = node.parent;
		}

		if (changed && !suppress_draw) {
			this.tree_drawer.must_draw = true;
		}
	},

	delete_node: function() {
		if (this.node.parent) {
			this.set_node(this.node.detach(), {bless: false});
		} else {												// There are good reasons why the root node can't be replaced.
			if (this.node.children.length > 0) {
				for (let child of this.node.children) {
					child.detach();
				}
				this.draw();									// Clear the next move markers.
				this.tree_drawer.must_draw = true;
			}
			this.node.save_ok = false;
		}
		if (this.tabber.remove_deleted_nodes()) {
			this.tabber.draw_tabs(this.node);
		}
	},

	delete_other_lines: function() {

		this.promote_to_main_line(true);

		let node = this.node.get_root();
		let changed = false;

		while (node.children.length > 0) {
			for (let child of node.children.slice(1)) {
				child.detach();
				changed = true;
			}
			node = node.children[0];
		}

		if (changed) {
			this.draw();
			this.tree_drawer.must_draw = true;
			if (this.tabber.remove_deleted_nodes()) {
				this.tabber.draw_tabs(this.node);
			}
		}
	},

	forget_analysis_tree: function() {
		this.node.forget_analysis_tree();
		this.halt();
		this.draw();
	},

	// Engine......................................................................................

	receive_object: function(o) {

		if (valid_analysis_object(o) === false) {
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
			hub.engine.setup_with_command(config.arbitrary_command, config.arbitrary_argslist);
		} else {
			hub.engine.setup(config.engine, config.engineconfig, config.weights);
		}
		this.draw();
	},

	// Misc........................................................................................

	display_props: function(rootflag) {
		let props = rootflag ? this.node.get_root().props : this.node.props;
		let lines = [];
		for (let key of Object.keys(props)) {
			lines.push(`${key}: [${props[key].join("][")}]`);
		}
		alert(lines.join("\n"));
	},

	calculate_square_size: function() {
		let dy = window.innerHeight - document.getElementById("boardcanvas").getBoundingClientRect().top;
		return Math.max(0, Math.floor((dy - 8) / 19));
	},

	log_ram: function() {
		console.log(`RAM after ${Math.floor(performance.now() / 1000)} seconds:`);
		for (let foo of Object.entries(process.memoryUsage())) {
			let type = foo[0] + " ".repeat(12 - foo[0].length);
			let mb = foo[1] / (1024 * 1024);
			let mb_rounded = Math.floor(mb * 1000) / 1000;			// 3 d.p.
			console.log(type, "(MB)", mb_rounded);
		}
	},

	quit: function() {
		this.engine.shutdown();
		config_io.save();					// As long as we use the sync save, this will complete before we
		ipcRenderer.send("terminate");		// send "terminate". Not sure about results if that wasn't so.
	},

	// Komi and rules are part of the board........................................................

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

	// Clickers in the infobox.....................................................................

	cycle_rules: function(reverse) {

		const values = ["Chinese", "Japanese"];

		let current = this.node.get_board().rules;

		let si = values.indexOf(current) + (reverse ? -1 : 1);
		if (si >= values.length) si = 0;
		if (si < 0) si = values.length - 1;

		this.coerce_rules(values[si]);
	},

	cycle_komi: function(reverse) {

		const values = [0, 0.5, 4.5, 5, 5.5, 6, 6.5, 7, 7.5];

		let current = this.node.get_board().komi;

		let si = values.indexOf(current) + (reverse ? -1 : 1);
		if (si >= values.length) si = 0;
		if (si < 0) si = values.length - 1;

		this.coerce_komi(values[si]);
	},

	cycle_numbers: function(reverse) {

		const values = ["LCB + Visits", "Score + Visits", "Delta + Visits", "LCB", "Score", "Delta", "Visits", "Visits (%)", "Order", "Policy", "Winrate"];

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

		if (this.maindrawer.draw_pv(this.node, s)) {
			return;
		}

		// We did not draw a PV, so if the last draw that actually happened was a PV, it
		// was for some other point, and we need to do a standard draw to hide it...

		if (this.maindrawer.last_draw_was_pv) {
			this.maindrawer.draw_standard(this.node);
		}
	},

	// Moving up / down the tree might create a pileup of events (maybe?) so we buffer them........

	input_up_down: function(n) {
		if (this.pending_up_down !== 0) {
			this.dropped_inputs++;
		}
		this.pending_up_down = n;		// We could consider adjusting by n rather than replacing.
	},

	// Spinners (in a setTimeout loop).............................................................

	active_tab_draw_spinner: function() {
		this.tabber.draw_active_tab(this.node);
		setTimeout(this.active_tab_draw_spinner.bind(this), Math.max(50, config.graph_draw_delay));			// Enforce minimum of 50
	},

	graph_draw_spinner: function() {
		this.grapher.draw_graph(this.node);
		setTimeout(this.graph_draw_spinner.bind(this), Math.max(50, config.graph_draw_delay));				// Enforce minimum of 50
	},

	tree_draw_spinner: function() {
		if (this.tree_drawer.central_node !== this.node || this.tree_drawer.must_draw) {
			this.tree_drawer.draw_tree(this.node);
		}
		setTimeout(this.tree_draw_spinner.bind(this), Math.max(17, config.tree_draw_delay));				// Enforce minimum of 17
	},

	up_down_spinner: function() {

		// The point of this is to avoid a situation where a draw is slow, while up/down events are piling up, leading to a bunch of draws
		// being required all at once. Instead of that, up/down events just adjust a variable, and this spinner does the actual draws.

		let n = this.pending_up_down;
		this.pending_up_down = 0;

		if (n === 1) {
			this.next();
		} else if (n > 1) {
			this.forward(n);
		} else if (n === -1) {
			this.prev();
		} else if (n < -1) {
			this.backward(n * -1);
		}

		setTimeout(this.up_down_spinner.bind(this), config.input_delay);			// This can be a very low number, even 0 might be OK?
	},

	window_resize_checker: function() {

		let desired_config_width = Math.floor(window.innerWidth * zoomfactor);
		let desired_config_height = Math.floor(window.innerHeight * zoomfactor);

		if (config.width !== desired_config_width || config.height !== desired_config_height) {
			config.width = desired_config_width;
			config.height = desired_config_height;
			this.tree_drawer.must_draw = true;
			if (config.auto_square_size) {
				let new_size = this.calculate_square_size();
				if (new_size !== config.square_size) {
					this.set("square_size", new_size);
				}
			}
		}
		setTimeout(this.window_resize_checker.bind(this), 250);
	},

	bad_death_mark_spinner: function() {

		// Super-lame hack to deal with the situation where death marks were carried over from a previous search but then
		// the new search was terminated instantly (or never started) and those stale death marks need to be removed.

		if (Array.isArray(this.maindrawer.death_marks) && this.maindrawer.death_marks.length > 0) {
			if (!this.node.has_valid_analysis() || !this.node.analysis.ownership) {
				if (!hub.engine.desired || node_id_from_search_id(hub.engine.desired.id) !== this.node.id) {
					this.draw();
				}
			}
		}

		setTimeout(this.bad_death_mark_spinner.bind(this), 190);
	},

};
