"use strict";

// The tabber stores no info about the active tab, which is the domain of the hub.

const ACTIVE_TAB_MARKER = "active_marker";

function new_tabber() {
	let tabber = Object.create(tabber_prototype);
	tabber.tabs = [ACTIVE_TAB_MARKER];
	return tabber;
}

let tabber_prototype = {

	draw_tabs: function() {
		// TODO
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
		this.draw_tabs();
		return switch_node;
	},

	remove_deleted_nodes: function() {

		let fixed = [];

		for (let node of this.tabs) {
			if (node === ACTIVE_TAB_MARKER) {
				fixed.push(ACTIVE_TAB_MARKER);
			} else {
				if (!node.destroyed) {
					fixed.push(node);
				}
			}
		}

		this.tabs = fixed;
		this.draw_tabs();
	},

	create_inactive_tab: function(node) {

		if (typeof node !== "object" || node === null) {
			throw "create_inactive_tab(): bad argument";
		}

		// Returns the index, so it can be easily switched to immediately.

		let active_index = this.tabs.indexOf(ACTIVE_TAB_MARKER);
		if (active_index === -1) {
			throw "create_inactive_tab(): could not find ACTIVE_TAB_MARKER in tabs";
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
}



module.exports = new_tabber;
