"use strict";

const {defaults} = require("./config_io");

// Note that the alpha values are ignored (true on 2022-03-02).

const red = "#ff7777ff";
const blue = "#77ddddff";
const green = "#99dd55ff";
const yellow = "#dddd55ff";

const blue_bright = "#77eeffff";
const green_bright = "#99ff55ff";
const yellow_bright = "#ffff55ff";

module.exports = {

	"Blue / Green": {
		"top_colour_black": blue,
		"top_colour_white": blue,
		"off_colour_black": green,
		"off_colour_white": green,
	},

	"Blue / Green (brighter)": {
		"top_colour_black": blue_bright,
		"top_colour_white": blue_bright,
		"off_colour_black": green_bright,
		"off_colour_white": green_bright,
	},

	"Green / Yellow": {
		"top_colour_black": green,
		"top_colour_white": green,
		"off_colour_black": yellow,
		"off_colour_white": yellow,
	},

	"Green / Yellow (brighter)": {
		"top_colour_black": green_bright,
		"top_colour_white": green_bright,
		"off_colour_black": yellow_bright,
		"off_colour_white": yellow_bright,
	},

	"Red": {
		"top_colour_black": red,
		"top_colour_white": red,
		"off_colour_black": red,
		"off_colour_white": red,
	},

	"Green": {
		"top_colour_black": green,
		"top_colour_white": green,
		"off_colour_black": green,
		"off_colour_white": green,
	},

};
