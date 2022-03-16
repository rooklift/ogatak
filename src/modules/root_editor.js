"use strict";

const {pad} = require("./utils");

const supported_keys = {
	"PB": "Black",
	"BR": "BR",
	"PW": "White",
	"WR": "WR",
	"EV": "Event",
	"RO": "Round",
	"GN": "Name",
	"PC": "Place",
	"DT": "Date",
	"RE": "Result"
};

function init() {

	let ret = Object.assign(Object.create(root_editor_prototype), {
		outer_div: document.getElementById("rootprops"),
		inner_div: document.getElementById("rootprops_content"),
		forms: {},
		is_visible: false,
	});

	ret.set_font_size(config.info_font_size);

	for (let [key, label] of Object.entries(supported_keys)) {
		ret.inner_div.innerHTML += `<span class="yellow">${pad(label, 10, true)}</span> <input type="text" id="rootprops_${key}" value="">\n`;
	}

	// This bit needs to be a separate loop from the above, because the += above means the elements are recreated
	// a bunch of times. Meh...

	for (let key of Object.keys(supported_keys)) {
		ret.forms[key] = document.getElementById("rootprops_" + key);
		ret.forms[key].addEventListener("input", (event) => {
			hub.commit_root_edit(key);
		});
	}

	return ret;
}

let root_editor_prototype = {

	set_font_size: function(value) {
		this.inner_div.style["font-size"] = value.toString() + "px";
	},

	show: function() {

		this.outer_div.style["display"] = "block";
		this.is_visible = true;

		hub.halt();
		
		comment_drawer.textarea.blur();
		fullbox.hide();
	},

	hide: function() {
		for (let form of Object.values(this.forms)) {
			form.blur();
		}
		this.outer_div.style["display"] = "none";
		this.is_visible = false;
	},

	update_from_root: function(root) {
		for (let key of Object.keys(supported_keys)) {
			if (root.has_key(key)) {
				this.forms[key].value = root.get(key);
			} else {
				this.forms[key].value = "";
			}
		}
	},

};



module.exports = init();
