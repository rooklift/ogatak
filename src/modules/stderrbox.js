"use strict";

const {safe_html} = require("./utils");

function init() {
	let ret = Object.assign(Object.create(stderrbox_prototype), {
		outer_div: document.getElementById("stderrbox"),
		inner_div: document.getElementById("stderrbox_content"),
		is_visible: false,
	});
	ret.set_font_size(config.info_font_size);
	return ret;
}

let stderrbox_prototype = {

	set_font_size: function(value) {
		this.inner_div.style["font-size"] = value.toString() + "px";
	},

	show: function() {
		if (!this.is_visible) {
			this.outer_div.style["display"] = "block";
			this.is_visible = true;
			hub.halt();
			hub.disable_specials_except("stderrbox");
		}
	},

	hide: function() {
		if (this.is_visible) {
			this.outer_div.style["display"] = "none";
			this.is_visible = false;
		}
	},

	reset: function() {
		this.inner_div.innerHTML = "";
	},

	receive: function(s, spanclass = null) {
		s = safe_html(s);
		if (spanclass) {
			s = `<span class="${spanclass}">${s}</span>`;
		}
		s += "<br>";
		this.inner_div.innerHTML += s;
		if (this.is_visible) {
			this.outer_div.scrollTop = this.outer_div.scrollHeight;
		}
	},
};



module.exports = init();
