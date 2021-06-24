"use strict";

// FIXME - trees are now never getting destroyed
// (well, unless the GC is very smart, which it might be).

const fs = require("fs");
const path = require("path");
const {ipcRenderer} = require("electron");

const new_board_drawer = require("./board_drawer");
const new_engine = require("./engine");
const new_grapher = require("./grapher");
const new_node = require("./node");
const new_tabber = require("./tabber");
const new_tree_drawer = require("./tree_drawer");

const load_gib = require("./load_gib");
const load_ngf = require("./load_ngf");
const load_sgf = require("./load_sgf");
const save_sgf = require("./save_sgf");

const {defaults} = require("./config_io");
const {get_title, set_title} = require("./title");
const {handicap_stones, node_id_from_search_id, xy_to_s} = require("./utils");

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
		document.getElementById("boardcanvas")
	);

	hub.tree_drawer = new_tree_drawer(
		document.getElementById("treecanvas")
	);

	hub.engine = new_engine();

	if (config.arbitrary_command) {
		hub.engine.setup_with_command(config.arbitrary_command, config.arbitrary_argslist);
	} else {
		hub.engine.setup(config.engine, config.engineconfig, config.weights);
	}

	hub.__autoanalysis = false;					// Don't set this directly, because it should be ack'd
	hub.__autoplay = false;						// Don't set this directly, because it should be ack'd

	hub.tabber = new_tabber(
		document.getElementById("tabdiv")
	);

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
				this.set_node(node);
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
		this.set_node(switch_node);
		this.tabber.draw_tabs(this.node);
		this.update_title();
	},

	new_active_view: function() {
		let index = this.tabber.create_inactive_tab_after_active(this.node);
		this.switch_tab(index);
	},

	new_active_view_from_move: function(s) {
		let index = this.tabber.create_inactive_tab_after_active(this.node.try_move(s));
		this.switch_tab(index);
	},

	close_tab: function() {
		if (this.tabber.tabs.length === 1) {
			this.node = null;
			this.new_game(19, 19);
		} else {
			let node = this.tabber.close_active_tab();
			this.set_node(node);
		}
		this.tabber.draw_tabs(this.node);
		this.update_title();
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

		let node = new_node();

		if (width === height) {
			node.set("SZ", width);
		} else {
			node.set("SZ", `${width}:${height}`);
		}

		let points = handicap_stones(handicap, width, height, false);
		for (let point of points) {
			node.add_value("AB", point);
		}
		if (points.length > 1) {
			node.set("HA", points.length);
		}

		node.set("KM", komi);
		node.set("RU", rules);

		this.add_roots([node]);
	},

	place_handicap: function(handicap) {
		let board = this.node.get_board();
		this.__new_game(board.width, board.height, board.komi, board.rules, handicap);
	},

	// Tree........................................................................................

	set_node: function(node, keep_autoplay_settings) {

		if (!node || this.node === node) {
			return;
		}

		this.node = node;
		this.node.bless();

		let want_to_go = this.engine.desired ? true : false;

		if (!keep_autoplay_settings) {
			if (this.__autoanalysis || this.__autoplay) {
				this.set_autoanalysis(false);
				this.set_autoplay(false);
				want_to_go = false;							// i.e. we halt only if we are turning off one of these things.
			}
		}

		if (want_to_go) {
			this.go();
		} else {
			this.halt();
		}

		this.draw();		// Done after adjusting the engine, since draw() looks at what the engine is doing.

		if (this.grapher.line_end && node.get_end() !== this.grapher.line_end.get_end()) {		// line_end.get_end() because it maybe gained descendents.
			this.grapher.draw_graph(this.node);
		} else {
			this.grapher.draw_position(this.node);
		}
	},

	try_move: function(s) {
		let node = this.node.try_move(s);
		this.set_node(node, true);
	},

	pass: function() {
		let node = this.node.pass();
		this.set_node(node, true);
	},

	play_best: function() {
		if (this.node.has_valid_analysis()) {
			let s = this.node.get_board().parse_gtp_move(this.node.analysis.moveInfos[0].move);
			if (!s) {
				this.pass();
			} else {
				let node = this.node.force_move(s);
				this.set_node(node, true);
			}
		}
	},

	prev: function() {
		if (this.node.parent) {
			this.set_node(this.node.parent);
		}
	},

	next: function() {
		if (this.node.children.length > 0) {
			this.set_node(this.node.get_blessed_child(), true);
		}
	},

	backward: function(n) {
		this.set_node(this.node.backward_helper(n));
	},

	forward: function(n) {
		this.set_node(this.node.forward_helper(n));
	},

	go_to_root: function() {
		this.set_node(this.node.get_root());
	},

	go_to_end: function() {
		this.set_node(this.node.get_end());
	},

	prev_sibling: function() {
		let sib = this.node.greater_sibling();
		if (sib) {
			this.set_node(sib);
		}
	},

	next_sibling: function() {
		let sib = this.node.lesser_sibling();
		if (sib) {
			this.set_node(sib);
		}
	},

	return_to_variation_start: function() {
		this.set_node(this.node.return_to_variation_start_helper());
	},

	return_to_main: function() {
		this.set_node(this.node.return_to_main_line_helper());
		this.node.bless_main_line();
		this.grapher.draw_graph(this.node);
		this.tree_drawer.must_draw = true;		// Needed in case we were already on main, but blessing the line changed the main line.
	},

	previous_fork: function() {
		this.set_node(this.node.previous_fork_helper());
	},

	next_fork: function() {
		this.set_node(this.node.next_fork_helper());
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
			this.set_node(this.node.detach());
		} else {											// There are good reasons why the root node can't be replaced.
			if (this.node.children.length > 0) {
				for (let child of this.node.children) {
					child.detach();
				}
				this.draw();								// Clear the next move markers.
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

		if (typeof o !== "object" || o === null || o.noResults) {
			return;
		}

		let relevant_node_id = node_id_from_search_id(o.id);

		if (relevant_node_id === this.node.id) {

			this.node.receive_analysis(o);			// This does all needed validation of o

			if (this.__autoanalysis && o.rootInfo && o.rootInfo.visits > config.autoanalysis_visits) {

				if (this.node.children.length > 0) {
					this.next();
					return;							// Just to avoid the redundant draw()
				} else {
					this.halt();
				}

			} else if (this.__autoplay && o.rootInfo && o.rootInfo.visits > config.autoanalysis_visits) {

				if (this.node.parent && this.node.parent.has_pass() && this.node.has_pass()) {		// Already had 2 passes, incoming move is 3rd (maybe).
					this.halt();
				} else {
					this.play_best();
					return;							// Just to avoid the redundant draw()
				}
			}

			this.draw();

		} else if (this.node.parent && relevant_node_id === this.node.parent.id && !this.__autoplay) {

			// We received info for the parent node, which commonly happens when advancing forwards. It's
			// OK to set this info in the parent, unless we're in autoplay mode, in which case it's better
			// to leave the analysis that actually triggered the move.

			this.node.parent.receive_analysis(o);

		}
	},

	go: function() {
		this.engine.analyse(this.node);
	},

	halt: function() {
		this.set_autoanalysis(false);
		this.set_autoplay(false);
		this.engine.halt();
	},

	toggle_ponder: function() {
		if (this.engine.desired) {
			this.halt();
		} else {
			this.go();
		}
	},

	set_autoanalysis: function(val) {

		this.__autoanalysis = val ? true : false;

		if (this.__autoanalysis) {
			ipcRenderer.send("set_check_true", ["Analysis", "Autoanalysis"]);
		} else {
			ipcRenderer.send("set_check_false", ["Analysis", "Autoanalysis"]);
		}
	},

	set_autoplay: function(val) {

		this.__autoplay = val ? true : false;

		if (this.__autoplay) {
			ipcRenderer.send("set_check_true", ["Analysis", "Self-play"]);
		} else {
			ipcRenderer.send("set_check_false", ["Analysis", "Self-play"]);
		}
	},

	start_autoanalysis() {
		this.set_autoanalysis(true);
		this.set_autoplay(false);
		if (!this.engine.desired) {
			this.go();
		}
	},

	start_autoplay: function() {
		this.set_autoanalysis(false);
		this.set_autoplay(true);
		if (!this.engine.desired) {
			this.go();
		}
	},

	maybe_start_engine: function() {	// This gets called only by hub_settings.js, and never if config.arbitrary_command exists.
		if (this.engine.exe) {
			this.halt();
			this.engine.shutdown();
			this.engine = new_engine();
		}
		this.engine.setup(config.engine, config.engineconfig, config.weights);		// Won't do anything unless all 3 are valid.
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
		return Math.floor((dy - 8) / 19);
	},

	quit: function() {
		this.engine.shutdown();
		save_config();						// As long as we use the sync save, this will complete before we
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
			ipcRenderer.send("set_check_true", ["Display", "Candidate moves"]);
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

		ipcRenderer.send("set_checks", ["Display", "Numbers", values[si]]);
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

	// Spinners (in a setTimeout loop).............................................................

	active_tab_draw_spinner: function() {
		this.tabber.draw_active_tab(this.node);
		setTimeout(this.active_tab_draw_spinner.bind(this), Math.max(50, config.graph_draw_delay));
	},

	graph_draw_spinner: function() {
		this.grapher.draw_graph(this.node);
		setTimeout(this.graph_draw_spinner.bind(this), Math.max(50, config.graph_draw_delay));
	},

	tree_draw_spinner: function() {
		if (this.tree_drawer.central_node !== this.node || this.tree_drawer.must_draw) {
			this.tree_drawer.draw_tree(this.node);
		}
		setTimeout(this.tree_draw_spinner.bind(this), Math.max(17, config.tree_draw_delay));	// Wants a pretty tight schedule else it will feel laggy.
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
					ipcRenderer.send("set_checks", ["Sizes", "Board squares", new_size.toString()]);
				}
			}
		}
		setTimeout(this.window_resize_checker.bind(this), 250);
	},

};
