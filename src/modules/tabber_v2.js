"use strict";

const new_node = require("./node");
const thumbnail = require("./thumbnail");
const {get_title, set_title} = require("./title");

const ACTIVE_TAB_MARKER = "***";		// Some arbitrary thing.

let next_dom_id = 1;					// id for the DOM elements (img elements)

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
	update_img_outline(img, true);

	// So at this point, we have:      tabs === [ACTIVE_TAB_MARKER]
	//                              dom_ids === ["tab_1"]
	//
	// Note that, although sometimes hub.node is briefly null, the tabber
	// never has empty arrays, but rather length 1 in that case.

	return ret;
}

let tabber_prototype = {

	draw_active_tab: function(node, outlineflag = true) {

		let index = this.tabs.indexOf(ACTIVE_TAB_MARKER);
		let img = document.getElementsByClassName(this.dom_ids[index])[0];

		if (this.last_drawn_active_node_id === node.id) {
			update_img_outline(img, outlineflag);
		} else {
			update_img(img, node, outlineflag);
			this.last_drawn_active_node_id = node.id;
		}

		// Because the root properties could have been edited., we always do these...

		update_title(node);
		img.title = node.game_title_text();			// That is, the thumbnail mouseover text.
	},

	deactivate_node_activate_dom_id: function(node, dom_id) {

		this.draw_active_tab(node, false);			// Draw the active tab so it's up to date when frozen.

		let old_index = this.tabs.indexOf(ACTIVE_TAB_MARKER);
		assert(old_index !== -1);
		this.tabs[old_index] = node;

		let new_index = this.dom_ids.indexOf(dom_id);
		assert(new_index !== -1);

		let switch_node = this.tabs[new_index];
		this.tabs[new_index] = ACTIVE_TAB_MARKER;

		let img = document.getElementsByClassName(this.dom_ids[new_index])[0];
		update_img_outline(img, true);
		update_title(switch_node);

		assert(!switch_node.destroyed);
		return switch_node;
	},

	create_inactive_tab_at_end: function(node) {

		let dom_id = `tab_${next_dom_id++}`;
		this.tabs.push(node);
		this.dom_ids.push(dom_id);

		let img = new Image();
		img.className = dom_id;
		update_img(img, node, false);

		this.inner_div.appendChild(img);

		return dom_id;
	},

	close_active_tab: function() {

		assert(this.tabs.length > 1);

		let index = this.tabs.indexOf(ACTIVE_TAB_MARKER);
		let img = document.getElementsByClassName(this.dom_ids[index])[0];
		img.remove();

		this.tabs.splice(index, 1);
		this.dom_ids.splice(index, 1);

		if (index >= this.tabs.length) {
			index = this.tabs.length - 1;
		}

		img = document.getElementsByClassName(this.dom_ids[index])[0];
		update_img_outline(img, true);

		let node = this.tabs[index];
		this.tabs[index] = ACTIVE_TAB_MARKER;

		update_title(node);

		return node;
	},

	active_tab_is_last: function() {
		return this.tabs.indexOf(ACTIVE_TAB_MARKER) === this.tabs.length - 1;
	},

	tab_node_list: function(active_node) {
		let index = this.tabs.indexOf(ACTIVE_TAB_MARKER);
		assert(index !== -1);
		let ret = Array.from(this.tabs);
		ret[index] = active_node;
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
			update_img(img, node, this.tabs[n] === ACTIVE_TAB_MARKER);

			this.inner_div.appendChild(img);
		}
	},
};

// ------------------------------------------------------------------------------------------------

function update_img(img, node, outlineflag) {

	let thumb = thumbnail(node.get_board(), config.thumbnail_square_size);

	img.src = thumb.data;
	img.width = thumb.width;
	img.height = thumb.height;
	img.title = node.game_title_text();
	img.style.margin = `0 16px 16px 16px`;

	update_img_outline(img, outlineflag);
}

function update_img_outline(img, outlineflag) {
	img.style.outline = outlineflag ? `4px solid ${config.wood_colour}` : "none";
}

function update_title(node) {
	let desired = node.game_title_text();
	if (!desired) {
		desired = "Ogatak";
	}
	if (get_title() !== desired) {
		set_title(desired);
	}
}

// ------------------------------------------------------------------------------------------------

function assert(val) {		// The logic in this file is hairy enough that I want to have assert().
	if (!val) {
		throw new Error("Assertion failed.");
	}
}



module.exports = init();
