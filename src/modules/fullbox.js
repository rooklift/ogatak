"use strict";

const config_io = require("./config_io");
const {safe_html, pad} = require("./utils");

function init() {
	return Object.assign(Object.create(fullbox_prototype), {
		outer_div: document.getElementById("fbox"),
		inner_div: document.getElementById("fbox_content"),
		is_visible: false,
		stderr_mode: false,
	});
}

// is_visible will always correspond to outer_div.style being "block" or "none", but it's easier to access
// and also, there's the annoying fact that accessing .style doesn't work for the initial styling computed
// from the CSS (it only works for style that's "directly set").

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

	hide: function() {						// Also the only thing that ever does (this.stderr_mode = false)
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

	// --------------------------------------------------------------------------------------------

	enter_stderr_mode: function() {
		this.stderr_mode = true;
		this.inner_div.innerHTML = "";
		this.show();
	},

	exit_stderr_mode: function() {
		if (this.stderr_mode) {
			this.hide();
		}
	},

	accept_stderr: function(s) {
		if (this.stderr_mode) {
			this.inner_div.innerHTML += safe_html(s) + "<br>";
			this.outer_div.scrollTop = this.outer_div.scrollHeight;
		}
	},

	// --------------------------------------------------------------------------------------------

	about: function(name, version) {
		this.set(
			`<span class="blue">${name} ${version}</span> in <span class="blue">Electron ${process.versions.electron}</span>\n` +
			`Written by <span class="green">Rooklift</span>\n\n` +
			`Engine, engine config, and weights are at:\n\n` +
			`    <span class="yellow">${config.engine}</span>\n` +
			`    <span class="yellow">${config.engineconfig}</span>\n` +
			`    <span class="yellow">${config.weights}</span>\n\n` +
			`${name} config file is at:\n\n` +
			`    <span class="yellow">${config_io.filepath}</span>\n\n` +
			`(Press Escape)`
		);
	},

	display_node_props: function(node) {
		let props = node.props;
		let max_key_length = Math.max(...(Object.keys(props).map(k => k.length)));		// -Infinity if there are no keys
		let lines = [];
		for (let key of Object.keys(props)) {
			let vals = props[key].map(val => {
				val = safe_html(val);
				if (key === "PB" || key === "PW" || key === "RE") val = `<span class="blue">${val}</span>`;
				return val;
			});
			lines.push(`<span class="blue">${pad(safe_html(key), max_key_length, true)}:</span> [${vals.join("][")}]`);
		}
		this.set(lines.join("<br>"));
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

};



module.exports = init();
