"use strict";

function init() {
	let ret = Object.assign(Object.create(root_editor_prototype), {
		outer_div: document.getElementById("rootprops"),
		inner_div: document.getElementById("rootprops_content"),
		is_visible: false,
	});
	ret.set_font_size(config.info_font_size);
	return ret;
}

let root_editor_prototype = {

	set_font_size: function(value) {
		this.inner_div.style["font-size"] = value.toString() + "px";
	},

	show: function() {
		if (!this.is_visible) {
			this.outer_div.style["display"] = "block";
		}
		this.is_visible = true;
	},

};



module.exports = init();
