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
		let s = node.get("C");
		if (!s || config.comment_height <= 0) {
			this.div.innerHTML = "";
		} else {
			this.div.innerHTML = safe_html(s);
		}
	},

	set_font_size: function(value) {
		this.div.style["font-size"] = value.toString() + "px";
	}
};



module.exports = init();
