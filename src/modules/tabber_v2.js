"use strict";

const new_node = require("./node");
const thumbnail = require("./thumbnail");

const ACTIVE_TAB_MARKER = "***";		// Some arbitrary thing.

let next_dom_id = 1;					// id for the DOM elements (img elements)

function assert(val) {					// The logic in this file is hairy enough that I want to have assert().
	if (!val) {
		throw new Error("Assertion failed.");
	}
}

function init() {

	let ret = Object.assign(Object.create(tabber_prototype), {
		outer_div: document.getElementById("tabdiv"),
		inner_div: document.getElementById("tabdiv_inner"),
		tabs: [],
		dom_ids: [],
		last_drawn_active_node_id: null,
	});

	let dummy_node = new_node();		// Used for the initial thumbnail then forgotten about.

	ret.create_inactive_tab_at_end(dummy_node);
	ret.tabs[0] = ACTIVE_TAB_MARKER;

	let img = document.getElementsByClassName(ret.dom_ids[0])[0];
	ret.__update_outline(img, true);

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
		img.style.margin = `0 16px 16px 16px`;
		this.__update_outline(img, outlineflag);
	},

	__update_outline: function(img, outlineflag) {
		img.style.outline = outlineflag ? `4px solid ${config.wood_colour}` : "none";
	},

	draw_active_tab: function(node, outlineflag = true) {

		let index = this.tabs.indexOf(ACTIVE_TAB_MARKER);
		assert(index !== -1);

		let img = document.getElementsByClassName(this.dom_ids[index])[0];
		assert(img);

		if (this.last_drawn_active_node_id === node.id) {
			this.__update_outline(img, outlineflag);
		} else {
			this.__update_img(img, node, outlineflag);
			this.last_drawn_active_node_id = node.id;
		}
	},

	deactivate_node_activate_dom_id: function(node, dom_id) {

		assert(typeof node === "object" && node !== null);

		// Draw the active tab so it's up to date when frozen...

		this.draw_active_tab(node, false);

		// Deactivate the node provided...

		let old_active_index = this.tabs.indexOf(ACTIVE_TAB_MARKER);
		assert(old_active_index !== -1);
		this.tabs[old_active_index] = node;

		// Find what index in our arrays we need to activate...

		let new_active_index = this.dom_ids.indexOf(dom_id);
		assert(new_active_index !== -1);

		// Activate the provided index...

		let switch_node = this.tabs[new_active_index];
		this.tabs[new_active_index] = ACTIVE_TAB_MARKER;

		// Set the img border to exist...

		let img = document.getElementsByClassName(this.dom_ids[new_active_index])[0];
		assert(img);
		this.__update_outline(img, true);

		// Return the node of the new tab...

		assert(!switch_node.destroyed);
		return switch_node;
	},

	create_inactive_tab_at_end: function(node) {

		assert(typeof node === "object" && node !== null);

		let dom_id = `tab_${next_dom_id++}`;

		this.tabs.push(node);
		this.dom_ids.push(dom_id);

		let img = new Image();
		img.className = dom_id;
		this.__update_img(img, node, false);

		this.inner_div.appendChild(img);

		return dom_id;
	},

	close_active_tab: function() {

		assert(this.tabs.length > 1);

		let active_index = this.tabs.indexOf(ACTIVE_TAB_MARKER);
		assert(active_index !== -1);

		let img = document.getElementsByClassName(this.dom_ids[active_index])[0];
		assert(img);

		img.remove();

		this.tabs.splice(active_index, 1);
		this.dom_ids.splice(active_index, 1);

		if (active_index >= this.tabs.length) {
			active_index = this.tabs.length - 1;
		}

		img = document.getElementsByClassName(this.dom_ids[active_index])[0];
		assert(img);
		this.__update_outline(img, true);

		let node = this.tabs[active_index];
		this.tabs[active_index] = ACTIVE_TAB_MARKER;

		return node;
	},

	tab_node_list: function(active_node) {
		let active_index = this.tabs.indexOf(ACTIVE_TAB_MARKER);
		assert(active_index !== -1);
		let ret = Array.from(this.tabs);
		ret[active_index] = active_node;
		return ret;
	},

	draw_everything: function(active_node) {

		assert(active_node);

		this.inner_div.innerHTML = "";

		for (let n = 0; n < this.tabs.length; n++) {

			let node = (this.tabs[n] === ACTIVE_TAB_MARKER) ? active_node : this.tabs[n];
			let thumb = thumbnail(node.get_board(), config.thumbnail_square_size);

			let dom_id = `tab_${next_dom_id++}`;
			this.dom_ids[n] = dom_id;

			let img = new Image();
			img.className = dom_id;
			this.__update_img(img, node, this.tabs[n] === ACTIVE_TAB_MARKER);

			this.inner_div.appendChild(img);
		}
	},

};



module.exports = init();
