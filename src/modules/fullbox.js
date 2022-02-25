"use strict";

function init() {
	return Object.assign(Object.create(fullbox_prototype), {
		outer_div: document.getElementById("fullbox"),
		inner_div: document.getElementById("fullbox_content"),
		is_visible: false,
	});
}

let fullbox_prototype = {

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

	fix_font: function() {
		this.inner_div.style["font-size"] = config.info_font_size.toString() + "px";
	},

};



module.exports = init();
