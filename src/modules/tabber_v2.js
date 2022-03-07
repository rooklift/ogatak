"use strict";

const new_node = require("./node");
const thumbnail = require("./thumbnail");

const ACTIVE_TAB_MARKER = "***";		// Some arbitrary thing.

let next_dom_id = 1;					// id for the DOM elements (img elements)

function init() {

	let ret = Object.assign(Object.create(tabber_prototype), {
		div: document.getElementById("tabdiv_inner"),
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
	// Note that, although sometimes hub.node is briefly null, the tabber
	// never has empty arrays, but rather length 1 in that case.

	return ret;
}

let tabber_prototype = {

	__update_img: function(img, node, outlineflag) {

		let thumb = thumbnail(node.get_board(), config.thumbnail_square_size);

		img.src = thumb.data;
		img.width = thumb.width;
		img.height = thumb.height;
		img.title = node.game_title_text();

		img.style.outline = outlineflag ? `4px solid ${config.wood_colour}` : "none";
		img.style.margin = `0 16px 16px 16px`;
	},

	draw_active_tab: function(node, deactivating = false) {

		let index = this.tabs.indexOf(ACTIVE_TAB_MARKER);

		if (index === -1) {
			throw "draw_active_tab(): could not find active tab marker in tabs";
		}

		let img = document.getElementsByClassName(this.dom_ids[index])[0];
		if (!img) {
			throw "draw_active_tab(): could not find img element";
		}

		this.__update_img(img, node, !deactivating);
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
		this.__update_img(img, node, false);

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
		if (active_index === -1) {
			throw "tab_node_list(): could not find ACTIVE_TAB_MARKER in tabs";
		}
		let ret = Array.from(this.tabs);
		ret[active_index] = active_node;
		return ret;
	},

	draw_everything: function(active_node) {

		if (!active_node) {
			throw "draw_tabs(): requires active_node argument";
		}

		this.div.innerHTML = "";

		for (let n = 0; n < this.tabs.length; n++) {

			let node = (this.tabs[n] === ACTIVE_TAB_MARKER) ? active_node : this.tabs[n];
			let thumb = thumbnail(node.get_board(), config.thumbnail_square_size);

			let dom_id = `tab_${next_dom_id++}`;
			this.dom_ids[n] = dom_id;

			let img = new Image();
			img.className = dom_id;
			this.__update_img(img, node, this.tabs[n] === ACTIVE_TAB_MARKER);

			this.div.appendChild(img);
		}
	},

};



module.exports = init();
