"use strict";

// Note that the alpha values are ignored (true on 2022-03-02).

exports.red = "#ff7777ff";
exports.blue = "#77ddddff";
exports.green = "#99dd55ff";
exports.yellow = "#dddd55ff";

exports.blue_bright = "#77eeffff";
exports.green_bright = "#99ff55ff";
exports.yellow_bright = "#ffff55ff";

exports.menu_dict = {

	"Blue / Green": {
		"top_colour_black": exports.blue,
		"top_colour_white": exports.blue,
		"off_colour_black": exports.green,
		"off_colour_white": exports.green,
	},

	"Blue / Green (brighter)": {
		"top_colour_black": exports.blue_bright,
		"top_colour_white": exports.blue_bright,
		"off_colour_black": exports.green_bright,
		"off_colour_white": exports.green_bright,
	},

	"Green / Yellow": {
		"top_colour_black": exports.green,
		"top_colour_white": exports.green,
		"off_colour_black": exports.yellow,
		"off_colour_white": exports.yellow,
	},

	"Green / Yellow (brighter)": {
		"top_colour_black": exports.green_bright,
		"top_colour_white": exports.green_bright,
		"off_colour_black": exports.yellow_bright,
		"off_colour_white": exports.yellow_bright,
	},

	"Red": {
		"top_colour_black": exports.red,
		"top_colour_white": exports.red,
		"off_colour_black": exports.red,
		"off_colour_white": exports.red,
	},

	"Green": {
		"top_colour_black": exports.green,
		"top_colour_white": exports.green,
		"off_colour_black": exports.green,
		"off_colour_white": exports.green,
	},

};
