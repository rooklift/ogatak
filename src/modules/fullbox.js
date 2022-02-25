"use strict";

const {safe_html, pad} = require("./utils");

function init() {
	return Object.assign(Object.create(fullbox_prototype), {
		outer_div: document.getElementById("fullbox"),
		inner_div: document.getElementById("fullbox_content"),
		is_visible: false,
	});
}

let fullbox_prototype = {

	fix_font: function() {
		this.inner_div.style["font-size"] = config.info_font_size.toString() + "px";
	},

	show: function() {
		if (!this.is_visible) {
			this.outer_div.style["display"] = "block";
			this.is_visible = true;
		}
	},

	hide: function() {
		if (this.is_visible) {
			this.outer_div.style["display"] = "none";
			this.is_visible = false;
		}
	},

	set: function(s) {						// No sanitizing, beware!
		this.inner_div.innerHTML = s;
		console.log(s);
	},

	display_node_props(node) {
		let props = node.props;
		let max_key_length = Math.max(...(Object.keys(props).map(k => k.length)));		// -Infinity if there are no keys
		let lines = [];
		for (let key of Object.keys(props)) {
			let vals = props[key].map(val => safe_html(val));
			lines.push(`<span class="fullbox_em">${pad(safe_html(key), max_key_length, true)}:</span> [${vals.join("][")}]`);
		}
		this.set(lines.join("<br>"));
		this.show();
	},

};



module.exports = init();
