"use strict";

const {safe_html} = require("./utils");

function init() {
	return Object.assign(Object.create(comment_drawer_prototype), {
		div: document.getElementById("comments")
	});
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

	fix_font: function() {
		this.div.style["font-size"] = config.info_font_size.toString() + "px";
	}
};



module.exports = init();
