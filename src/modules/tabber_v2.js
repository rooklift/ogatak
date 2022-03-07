"use strict";

const new_node = require("./node");
const thumbnail = require("./thumbnail");

const ACTIVE_TAB_MARKER = "***";		// Some arbitrary thing.

let next_dom_id = 1;					// id for the DOM elements (img elements)

function init() {

	let ret = Object.assign(Object.create(tabber_prototype), {
		div: document.getElementById("tabdiv"),
		tabs: [],
		dom_ids: [],
	});

	let dummy_node = new_node();		// Used for the initial thumbnail then forgotten about.

	ret.create_inactive_tab_at_end(dummy_node);
	ret.tabs[0] = ACTIVE_TAB_MARKER;

	let img = document.getElementsByClassName(ret.dom_ids[0])[0];
	img.style.outline = `4px solid ${config.wood_colour}`;

	// So at this point, we have:      tabs === [ACTIVE_TAB_MARKER]
	//                              dom_ids === ["tab_1"]
	//
	// In the DOM, we have an image of a blank board.
	// When hub.new_game() gets its initial call, it does NOT send its node to be added to our tabs list.

	return ret;
}

let tabber_prototype = {

	draw_active_tab: function(node, deactivating = false) {

		let index = this.tabs.indexOf(ACTIVE_TAB_MARKER);

		if (index === -1) {
			throw "draw_active_tab(): could not find active tab marker in tabs";
		}

		let img = document.getElementsByClassName(this.dom_ids[index])[0];

		if (!img) {
			throw "draw_active_tab(): could not find img element";
		}

		let thumb = thumbnail(node.get_board(), config.thumbnail_square_size);

		img.src = thumb.data;
		img.width = thumb.width;
		img.height = thumb.height;
		img.title = node.game_title_text();

		if (deactivating) {
			img.style.outline = "none";
		}
	},

	deactivate_node_activate_dom_id: function(node, dom_id) {

		if (typeof node !== "object" || node === null) {
			throw "deactivate_node_activate_dom_id(): bad argument";
		}

		// Draw the active tab so it's up to date when frozen...

		this.draw_active_tab(node, true);

		// Deactivate the node provided...

		let old_active_index = this.tabs.indexOf(ACTIVE_TAB_MARKER);
		if (old_active_index === -1) {
			throw "deactivate_node_activate_dom_id(): could not find ACTIVE_TAB_MARKER in tabs";
		}
		this.tabs[old_active_index] = node;

		// Find what index in our arrays we need to activate...

		let new_active_index = this.dom_ids.indexOf(dom_id);
		if (new_active_index === -1) {
			throw "deactivate_node_activate_dom_id(): couldn't find index from dom id";
		}

		// Activate the provided index...

		let switch_node = this.tabs[new_active_index];
		this.tabs[new_active_index] = ACTIVE_TAB_MARKER;

		// Set the img border to exist...

		let img = document.getElementsByClassName(this.dom_ids[new_active_index])[0];
		if (!img) {
			throw "deactivate_node_activate_dom_id(): could not find img for newly-active tab";
		}
		img.style.outline = `4px solid ${config.wood_colour}`;

		// Return the node of the new tab...

		if (switch_node.destroyed) {
			throw "deactivate_node_activate_dom_id(): saw switch_node.destroyed";
		}
		return switch_node;
	},

	create_inactive_tab_at_end: function(node) {

		if (typeof node !== "object" || node === null) {
			throw "create_inactive_tab_at_end(): bad argument";
		}

		let dom_id = `tab_${next_dom_id++}`;

		this.tabs.push(node);
		this.dom_ids.push(dom_id);

		let img = new Image();
		img.className = dom_id;

		let thumb = thumbnail(node.get_board(), config.thumbnail_square_size);

		img.src = thumb.data;
		img.width = thumb.width;
		img.height = thumb.height;
		img.title = node.game_title_text();
		img.style.outline = "none";
		img.style.margin = `8px 16px 8px 16px`;
		
		this.div.appendChild(img);

		return dom_id;
	},

	close_active_tab: function() {

		if (this.tabs.length < 2) {
			throw "close_active_tab(): cannot be called on the only tab";
		}

		let active_index = this.tabs.indexOf(ACTIVE_TAB_MARKER);
		if (active_index === -1) {
			throw "close_active_tab(): could not find ACTIVE_TAB_MARKER in tabs";
		}

		let img = document.getElementsByClassName(this.dom_ids[active_index])[0];
		if (!img) {
			throw "close_active_tab(): could not find img for closed tab";
		}

		img.remove();

		this.tabs.splice(active_index, 1);
		this.dom_ids.splice(active_index, 1);

		if (active_index >= this.tabs.length) {
			active_index = this.tabs.length - 1;
		}

		img = document.getElementsByClassName(this.dom_ids[active_index])[0];
		if (!img) {
			throw "close_active_tab(): could not find img for next tab";
		}
		img.style.outline = `4px solid ${config.wood_colour}`;

		let node = this.tabs[active_index];
		this.tabs[active_index] = ACTIVE_TAB_MARKER;

		return node;
	},

	tab_node_list: function(active_node) {
		let active_index = this.tabs.indexOf(ACTIVE_TAB_MARKER);
		let ret = Array.from(this.tabs);
		ret[active_index] = active_node;
		return ret;
	},

	draw_tabs: function() {
	},

};



module.exports = init();
