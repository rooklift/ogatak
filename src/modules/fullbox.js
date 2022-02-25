"use strict";

function init() {
	return Object.assign(Object.create(fullbox_prototype), {
		outer_div: document.getElementById("fullbox"),
		inner_div: document.getElementById("fullbox_content"),
	});
}

let fullbox_prototype = {

	show: function() {
		this.outer_div.style["display"] = "block";
	},

	hide: function() {
		this.outer_div.style["display"] = "none";
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
