"use strict";

const config_io = require("./config_io");
const {safe_html, pad} = require("./utils");
const {translate, all_translators} = require("./translate");

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
			hub.stop();
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

		let translator_list = all_translators().map(s => `<span class="green">${s}</span>`);

		let s = `<span class="green">${name} ${version} --> Electron ${process.versions.electron}</span>\n\n`;

		if (config.gtp_filepath) {
			s += translate("ABOUT_GTP_COMMAND") + `\n\n`;
			s += `    <span class="yellow">${config.gtp_filepath}</span>\n`;
			if (Array.isArray(config.gtp_argslist)) {
				for (let item of config.gtp_argslist) {
					s += `    <span class="yellow">${item}</span>\n`;
				}
			}
			s += `\n`;
		} else {
			s += translate("ABOUT_FILE_LOCATIONS") + `\n\n`;
			s += `    <span class="yellow" id="about_box_engine">${config.engine || "(unset)"}</span>\n`;
			s += `    <span class="yellow" id="about_box_engineconfig">${config.engineconfig || "(unset)"}</span>\n`;
			s += `    <span class="yellow" id="about_box_weights">${config.weights || "(unset)"}</span>\n\n`;
		}

		s += translate("ABOUT_CONFIG_LOCATION") + `\n\n`;
		s += `    <span class="yellow">${config_io.filepath}</span>\n\n`;
		s += translate("ABOUT_RAM_USAGE") + `\n\n`;
		s += `${ram_strings.join("\n")}` + `\n\n`;
		s += translate("ABOUT_THANKS_TRANSLATORS") + `\n\n`;
		s += `    ` + translator_list.join("\n    ");

		this.set(s);
	},

	warn_bad_config: function() {
		this.set(
			`<span class="blue">${config_io.filename}</span> -- ` + translate("BAD_CONFIG_1") + `\n\n` +
			translate("BAD_CONFIG_2") + `\n` +
			translate("BAD_CONFIG_3") + `\n\n` +
			translate("BAD_CONFIG_4") + `\n` +
			translate("BAD_CONFIG_5") + `\n\n` +
			`<span class="yellow">${config_io.error()}</span>`
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

	display_perf_report: function(all_stats) {

		if (all_stats.B.moves < 1 || all_stats.W.moves < 1) {
			return;
		}

		let lines = [];
		let winners = all_stats.winners;

		for (let key of ["B", "W"]) {

			let stats = all_stats[key];
			let span_string;

			lines.push(`<span class="blue">${stats.name}</span> (${key})`);
			lines.push(`${stats.moves_analysed} of ${stats.moves} moves analysed - main line only:`);
			lines.push(``);
			span_string = winners.accuracy === key ? `<span class="green">` : "<span>";
			lines.push(`                 Accuracy: ${span_string} ${stats.accuracy.toFixed(1)}</span>`);
			span_string = winners.points_lost === key ? `<span class="green">` : "<span>";
			lines.push(`          Mean point loss: ${span_string} ${(stats.points_lost / stats.moves_analysed).toFixed(1)}</span>`);
			span_string = winners.top1 === key ? `<span class="green">` : "<span>";
			lines.push(`             AI best move: ${span_string} ${(stats.top1 * 100 / stats.moves_analysed).toFixed(1)}%</span>`);
			span_string = winners.top5_approved === key ? `<span class="green">` : "<span>";
			lines.push(`              AI approved: ${span_string} ${(stats.top5_approved * 100 / stats.moves_analysed).toFixed(1)}%</span>` +
				`  (AI top 5 and point loss < 0.5)`);
			lines.push("");
			lines.push("");
		}

		this.set(lines.join("<br>"));
	},

};



module.exports = init();
