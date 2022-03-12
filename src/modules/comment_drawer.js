"use strict";

function init() {
	let ret = Object.assign(Object.create(comment_drawer_prototype), {
		div: document.getElementById("comments"),								// FIXME - not a div any more, change name.
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

		if (config.comment_height <= 0) {
			this.div.blur();
			this.div.value = "";
		} else if (!s) {
			this.div.value = "";
		} else {
			this.div.value = s;			// safe_html(s);			// Not needed for textarea I guess.
		}
	},

	set_font_size: function(value) {
		this.div.style["font-size"] = value.toString() + "px";
	}
};



module.exports = init();
