"use strict";

const {pad} = require("./utils");
const {translate} = require("./translate");

const supported_keys = {
	"PB": translate("INFO_BLACK"),
	"BR": translate("INFO_BLACK_RANK"),
	"PW": translate("INFO_WHITE"),
	"WR": translate("INFO_WHITE_RANK"),
	"EV": translate("INFO_EVENT"),
	"RO": translate("INFO_ROUND"),
	"GN": translate("INFO_GAME_NAME"),
	"PC": translate("INFO_PLACE"),
	"DT": translate("INFO_DATE"),
	"RE": translate("INFO_RESULT"),
};

let padding_value = 10;

for (let value of Object.values(supported_keys)) {
	if (value.length > padding_value) {
		padding_value = value.length;
	}
}

function init() {

	let ret = Object.assign(Object.create(root_editor_prototype), {
		outer_div: document.getElementById("rootprops"),
		inner_div: document.getElementById("rootprops_content"),
		forms: {},
		is_visible: false,
	});

	ret.set_font_size(config.info_font_size);

	let s = "";
	for (let [key, label] of Object.entries(supported_keys)) {
		s += `<span class="yellow">${pad(label, padding_value, true)}</span> <input type="text" id="rootprops_${key}" value="">\n`;
	}
	ret.inner_div.innerHTML = s;

	// Now that the elements actually exist, we can do this...

	for (let key of Object.keys(supported_keys)) {
		ret.forms[key] = document.getElementById("rootprops_" + key);
	}

	// Event listeners to update the root node on changes are set up in __start_handlers.js.

	return ret;
}

let root_editor_prototype = {

	set_font_size: function(value) {
		this.inner_div.style["font-size"] = value.toString() + "px";
	},

	show: function() {
		if (!this.is_visible) {
			this.outer_div.style["display"] = "block";
			this.is_visible = true;
			hub.stop();
			hub.disable_specials_except("root_editor");
		}
	},

	hide: function() {
		if (this.is_visible) {
			for (let form of Object.values(this.forms)) {
				form.blur();
			}
			this.outer_div.style["display"] = "none";
			this.is_visible = false;
		}
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

	handle_tab_key: function() {

		// The tab key gets a preventDefault() but we will miss it here, so the handler calls this method...

		if (!this.is_visible) {
			return;
		}

		let active_element = document.activeElement;
		let forms = Object.values(this.forms);
		let target = null;

		for (let n = 0; n < forms.length - 1; n++) {		// The - 1 is correct. Don't test final form.
			if (active_element === forms[n]) {
				target = forms[n + 1];
				break;
			}
		}

		if (!target) {
			target = forms[0];
		}

		target.focus();
		target.selectionStart = target.selectionEnd = target.value.length;
	},

};



module.exports = init();
