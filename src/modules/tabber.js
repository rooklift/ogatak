"use strict";

// The tabber stores no info about the active tab, which is the domain of the hub.
//
// The tabber does NOT automatically draw itself when the tabs change in any way,
// therefore care must be taken by the hub to draw at the right times.

const thumbnail = require("./thumbnail");

const ACTIVE_TAB_MARKER = "***";		// Some arbitrary thing.

function new_tabber(tabdiv) {
	let tabber = Object.create(tabber_prototype);
	tabber.tabs = [ACTIVE_TAB_MARKER];
	tabber.tabdiv = tabdiv;
	tabber.image_cache = {};
	tabber.last_drawn_active_id = "";
	return tabber;
}

let tabber_prototype = {

	draw_tabs: function(active_node) {

		if (!active_node) {
			throw "draw_tabs(): requires active_node argument";
		}

		this.tabdiv.innerHTML = "";

		this.tabdiv.appendChild(document.createElement("br"));

		let items = [];

		let seen_node_ids = {};

		for (let n = 0; n < this.tabs.length; n++) {

			let node = (this.tabs[n] === ACTIVE_TAB_MARKER) ? active_node : this.tabs[n];

			seen_node_ids[node.id] = true;

			if (!this.image_cache[node.id]) {
				this.image_cache[node.id] = thumbnail(node.get_board(), config.thumbnail_square_size);
			}

			let img = new Image();
			img.src = this.image_cache[node.id];
			img.className = `tab_${n}`;
			img.style.outline = (this.tabs[n] === ACTIVE_TAB_MARKER) ? `4px solid ${config.wood_colour}` : "none";

			this.tabdiv.appendChild(img);
			this.tabdiv.appendChild(document.createElement("br"));
			this.tabdiv.appendChild(document.createElement("br"));
		}

		for (let key of Object.keys(this.image_cache)) {
			if (!seen_node_ids[key]) {
				delete this.image_cache[key];
			}
		}
	},

	draw_active_tab: function(node) {

		let active_index = this.tabs.indexOf(ACTIVE_TAB_MARKER);
		if (active_index === -1) {
			throw "draw_active_tab(): could not find ACTIVE_TAB_MARKER in tabs";
		}

		let img = document.getElementsByClassName(`tab_${active_index}`)[0];
		if (!img) {
			return;
		}

		if (!this.image_cache[node.id]) {
			this.image_cache[node.id] = thumbnail(node.get_board(), config.thumbnail_square_size);
		}

		img.src = this.image_cache[node.id];

		if (this.last_drawn_active_id !== node.id) {
			delete this.image_cache[this.last_drawn_active_id];		// We probably don't need this now.
		}

		this.last_drawn_active_id = node.id;
	},

	deactivate_node_activate_index: function(node, new_active_index) {

		if (typeof node !== "object" || node === null || typeof new_active_index !== "number" || new_active_index < 0 || new_active_index >= this.tabs.length) {
			throw "deactivate_node_activate_index(): bad argument";
		}

		// Deactivate the node provided...

		let old_active_index = this.tabs.indexOf(ACTIVE_TAB_MARKER);
		if (old_active_index === -1) {
			throw "deactivate_node_activate_index(): could not find ACTIVE_TAB_MARKER in tabs";
		}

		this.tabs[old_active_index] = node;

		// Activate the provided index, returning the activated node...

		let switch_node = this.tabs[new_active_index];
		if (switch_node.destroyed) {
			throw "deactivate_node_activate_index(): saw switch_node.destroyed";
		}

		this.tabs[new_active_index] = ACTIVE_TAB_MARKER;
		return switch_node;
	},

	remove_deleted_nodes: function() {				// Returns true iff some tab was deleted.

		let initial_length = this.tabs.length;

		let fixed = [];

		for (let node of this.tabs) {
			if (node === ACTIVE_TAB_MARKER || !node.destroyed) {
				fixed.push(node);
			}
		}

		this.tabs = fixed;

		return fixed.length !== initial_length;
	},

	create_inactive_tab_after_active: function(node) {

		if (typeof node !== "object" || node === null) {
			throw "create_inactive_tab_after_active(): bad argument";
		}

		// Returns the index, so it can be easily switched to immediately.

		let active_index = this.tabs.indexOf(ACTIVE_TAB_MARKER);
		if (active_index === -1) {
			throw "create_inactive_tab_after_active(): could not find ACTIVE_TAB_MARKER in tabs";
		}

		this.tabs.splice(active_index + 1, 0, node);

		return active_index + 1;
	},

	create_inactive_tab_at_end: function(node) {

		if (typeof node !== "object" || node === null) {
			throw "create_inactive_tab_at_end(): bad argument";
		}

		this.tabs.push(node);

		return this.tabs.length - 1;
	},

	close_active_tab: function() {

		if (this.tabs.length < 2) {
			throw "close_active_tab(): cannot be called on the only tab";
		}

		let active_index = this.tabs.indexOf(ACTIVE_TAB_MARKER);
		if (active_index === -1) {
			throw "close_active_tab(): could not find ACTIVE_TAB_MARKER in tabs";
		}

		this.tabs.splice(active_index, 1);

		if (active_index >= this.tabs.length) {
			active_index -= 1;
		}

		let node = this.tabs[active_index];

		this.tabs[active_index] = ACTIVE_TAB_MARKER;

		return node;
	},
};



module.exports = new_tabber;
