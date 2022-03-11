"use strict";

const {safe_html} = require("./utils");

function init() {
	let ret = Object.assign(Object.create(comment_drawer_prototype), {
		div: document.getElementById("comments")
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
			this.div.value = safe_html(s);
		}
	},

	set_font_size: function(value) {
		this.div.style["font-size"] = value.toString() + "px";
	}
};



module.exports = init();
