"use strict";

const {defaults} = require("./config_io");

module.exports = {

	Default: {
		"best_colour_black": defaults.best_colour_black,
		"best_colour_white": defaults.best_colour_white,
		"circle_best": defaults.circle_best
	},

	Subtle: {
		"best_colour_black": "#ddcc99ff",
		"best_colour_white": "#ddcc99ff",
		"circle_best": false
	},

	Ultrasubtle: {
		"best_colour_black": defaults.wood_colour,
		"best_colour_white": defaults.wood_colour,
		"circle_best": false
	},

};
