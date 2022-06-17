"use strict";

const config_io = require("./config_io");
const {safe_html, pad} = require("./utils");

function init() {
	let ret = Object.assign(Object.create(fullbox_prototype), {
		outer_div: document.getElementById("fbox"),
		inner_div: document.getElementById("fbox_content"),
		is_visible: false,
	});
	ret.set_font_size(config.info_font_size);
	return ret;
}

// is_visible will always correspond to outer_div.style being "block" or "none", but it's easier to access
// and also, there's the annoying fact that accessing .style doesn't work for the initial styling computed
// from the CSS (it only works for style that's "directly set").

let fullbox_prototype = {

	set_font_size: function(value) {
		this.inner_div.style["font-size"] = value.toString() + "px";
	},

	show: function() {
		if (!this.is_visible) {
			this.outer_div.style["display"] = "block";
			this.is_visible = true;
			hub.halt();
			hub.disable_specials_except("fullbox");
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
		this.show();
	},

	// --------------------------------------------------------------------------------------------

	about: function(name, version) {

		let ram_strings = [];
		for (let foo of Object.entries(process.memoryUsage())) {
			let type = pad(foo[0], 16, true);
			let mb = foo[1] / (1024 * 1024);
			let mb_rounded = Math.floor(mb * 1000) / 1000;			// 3 d.p.
			ram_strings.push(`${type} : ${mb_rounded}`);
		}

		this.set(
			`<span class="green">${name} ${version}</span> running in <span class="blue">Electron ${process.versions.electron}</span>\n\n` +
			`Engine, engine config, and weights are at:\n\n` +
			`    <span class="yellow" id="about_box_engine">${config.engine || "(unset)"}</span>\n` +
			`    <span class="yellow" id="about_box_engineconfig">${config.engineconfig || "(unset)"}</span>\n` +
			`    <span class="yellow" id="about_box_weights">${config.weights || "(unset)"}</span>\n\n` +
			`${name} config file is at:\n\n` +
			`    <span class="yellow">${config_io.filepath}</span>\n\n` +
			`RAM usage (MB) (engine not included):\n\n` + 
			`${ram_strings.join("\n")}`
		);
	},

	warn_bad_config: function() {
		this.set(
			`<span class="blue">${config_io.filename}</span> could not be parsed.\n\n` +
			`It will not be saved to until you fix this.\n` +
			`This means your settings will not be saved.\n\n` +
			`You should fix this.\n` +
			`You can also just delete the file.\n\n` +
			`Error: <span class="yellow">${config_io.error()}</span>`
		);
	},

	display_node_props: function(node) {
		let props = node.props;
		let max_key_length = Math.max(...(Object.keys(props).map(k => k.length)));		// -Infinity if there are no keys
		let lines = [];
		for (let key of Object.keys(props)) {
			let vals = props[key].map(val => ["PB", "PW", "RE"].includes(key) ? `<span class="blue">${safe_html(val)}</span>` : safe_html(val));
			lines.push(`<span class="blue">${pad(safe_html(key), max_key_length, true)}:</span> [${vals.join("][")}]`);
		}
		this.set(lines.join("<br>"));
	},

};



module.exports = init();
