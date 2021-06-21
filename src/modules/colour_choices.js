"use strict";

const {defaults} = require("./config_io");

module.exports = {

	Green: {
		"top_colour_black": "#77ddddff",
		"top_colour_white": "#77ddddff",
		"off_colour_black": "#99dd55ff",
		"off_colour_white": "#99dd55ff",
	},

	Transparent: {
		"top_colour_black": defaults.wood_colour,
		"top_colour_white": defaults.wood_colour,
		"off_colour_black": defaults.wood_colour,
		"off_colour_white": defaults.wood_colour,
	},

};
