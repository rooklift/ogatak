"use strict";

function init() {
	let ret = Object.assign(Object.create(comment_drawer_prototype), {
		textarea: document.getElementById("comments"),
	});
	ret.set_font_size(config.info_font_size);
	return ret;
}

let comment_drawer_prototype = {

	draw: function(node) {

		let s = "";

		if (node.has_key("C")) {
			s = node.get("C");
		} else if (node.has_key("GC")) {
			s = node.get("GC");
		}

		if (config.comment_box_height <= 0) {		// It's still present, just offscreen, because comment_box_height actually just adjusts the tree height.
			this.textarea.blur();
			this.textarea.value = "";
			this.textarea.style.display = "none";
			this.textarea.readOnly = true;			// Maybe paranoia, but it should never be edited by the user in this condition.
		} else {
			this.textarea.readOnly = false;
			this.textarea.value = s;				// safe_html(s);			// Not needed for textarea I guess.
			this.textarea.style.display = "block";
		}
	},

	set_font_size: function(value) {
		this.textarea.style["font-size"] = value.toString() + "px";
	}
};



module.exports = init();
