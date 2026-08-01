"use strict";

function init() {
	let ret = Object.assign(Object.create(comment_drawer_prototype), {
		gridder: document.getElementById("gridder_tree_comments"),
		textarea: document.getElementById("comments"),
		handle: document.getElementById("commentshandle"),
		handle_dragging: false,							// Used in __start_spinners.js. These 4 are for the
		pending_handle_drag_y: null,					// resize handle, which adjusts config.comment_box_height
		handle_drag_start_y: 0,							// by the mouse's movement since the drag started,
		handle_drag_start_height: 0,					// so there's no jump on grabbing the handle.
	});
	ret.set_font_size(config.info_font_size);
	ret.apply_height();
	return ret;
}

let comment_drawer_prototype = {

	needs_state_fix: function() {

		// i.e. hidden when it should be visible, or vice versa.
		// We rely on readOnly being correlated with the other relevant stuff e.g. display = "block".

		if (config.comment_box_height <= 0 && !this.textarea.readOnly) {
			return true;
		}

		if (config.comment_box_height > 0 && this.textarea.readOnly) {
			return true;
		}

		return false;
	},

	draw: function(node) {

		let s = "";

		if (node.has_key("C")) {
			s = node.get("C");
		} else if (node.has_key("GC")) {
			s = node.get("GC");
		}

		if (config.comment_box_height <= 0) {
			this.textarea.blur();
			this.textarea.value = "";
			this.textarea.style.display = "none";
			this.textarea.readOnly = true;				// Maybe paranoia, but it should never be edited by the user in this condition.
		} else {
			this.textarea.readOnly = false;
			this.textarea.value = s;					// safe_html(s);			// Not needed for textarea I guess.
			this.textarea.style.display = "block";
		}
	},

	set_font_size: function(value) {
		this.textarea.style["font-size"] = value.toString() + "px";
	},

	apply_height: function() {							// Apply config.comment_box_height
		this.gridder.style["grid-template-rows"] = `minmax(0, 1fr) min-content ${Math.max(0, config.comment_box_height)}px`;
	}
};



module.exports = init();
