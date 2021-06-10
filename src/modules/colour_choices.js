"use strict";

const {defaults} = require("./config_io");

module.exports = {

	Green: {
		"best_colour_black": "#99dd55ff",
		"best_colour_white": "#99dd55ff",
		"circle_best": true
	},

	Transparent: {
		"best_colour_black": defaults.wood_colour,
		"best_colour_white": defaults.wood_colour,
		"circle_best": false
	},

};
