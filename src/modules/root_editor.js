"use strict";

const supported_keys = ["PB", "PW"];

function init() {

	let ret = Object.assign(Object.create(root_editor_prototype), {
		outer_div: document.getElementById("rootprops"),
		inner_div: document.getElementById("rootprops_content"),
		forms: {},
		is_visible: false,
	});

	ret.set_font_size(config.info_font_size);

	for (let key of supported_keys) {

		ret.forms[key] = document.getElementById("rootprops_" + key);

		ret.forms[key].addEventListener("input", (event) => {
			hub.commit_root_edit(key);
		});
	}

	return ret;
}

let root_editor_prototype = {

	set_font_size: function(value) {
		this.inner_div.style["font-size"] = value.toString() + "px";			// FIXME - doesn't work for the forms?
	},

	show: function() {
		if (!this.is_visible) {
			this.outer_div.style["display"] = "block";
		}
		this.is_visible = true;
		comment_drawer.textarea.blur();
		fullbox.hide();
	},

	hide: function() {
		for (let form of Object.values(this.forms)) {
			form.blur();
		}
		if (this.is_visible) {
			this.outer_div.style["display"] = "none";
		}
		this.is_visible = false;
	},

	update_from_root: function(root) {
		for (let key of supported_keys) {
			if (root.has_key(key)) {
				this.forms[key].value = root.get(key);
			} else {
				this.forms[key].value = "";
			}
		}
	},

};



module.exports = init();
