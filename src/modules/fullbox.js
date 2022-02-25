"use strict";

const {safe_html, pad} = require("./utils");

function init() {
	return Object.assign(Object.create(fullbox_prototype), {
		outer_div: document.getElementById("fullbox"),
		inner_div: document.getElementById("fullbox_content"),
		is_visible: false,
		stderr_mode: false,
	});
}

let fullbox_prototype = {

	fix_font: function() {
		this.inner_div.style["font-size"] = config.info_font_size.toString() + "px";
	},

	show: function() {
		if (!this.is_visible) {
			this.outer_div.style["display"] = "block";
		}
		this.is_visible = true;
	},

	hide: function() {
		if (this.is_visible) {
			this.outer_div.style["display"] = "none";
		}
		this.is_visible = false;
		this.stderr_mode = false;
	},

	set: function(s) {						// No sanitizing, beware!
		if (!this.stderr_mode) {
			this.inner_div.innerHTML = s;
			this.show();
		}
	},

	display_node_props: function(node) {
		let props = node.props;
		let max_key_length = Math.max(...(Object.keys(props).map(k => k.length)));		// -Infinity if there are no keys
		let lines = [];
		for (let key of Object.keys(props)) {
			let vals = props[key].map(val => {
				val = safe_html(val)
				if (key === "PB" || key === "PW" || key === "RE") val = `<span class="fullbox_em">${val}</span>`;
				return val;
			});
			lines.push(`<span class="fullbox_em">${pad(safe_html(key), max_key_length, true)}:</span> [${vals.join("][")}]`);
		}
		this.set(lines.join("<br>"));
	},

	enter_stderr_mode: function() {
		this.stderr_mode = true;
		this.inner_div.innerHTML = "";
		this.show();
	},

	accept_stderr: function(s) {
		if (this.stderr_mode) {
			this.inner_div.innerHTML += safe_html(s) + "<br>";
			this.outer_div.scrollTop = this.outer_div.scrollHeight
		}
	},

};



module.exports = init();
