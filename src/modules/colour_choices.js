"use strict";

// Note that the alpha values are ignored (true on 2022-03-02).
// Note that the values must be given in #rrggbb format (no shorthand like "red").

exports.red = "#ff7777ff";
exports.blue = "#77ddddff";
exports.green = "#99dd55ff";
exports.yellow = "#dddd55ff";

exports.blue_bright = "#77eeffff";
exports.green_bright = "#99ff55ff";
exports.yellow_bright = "#ffff55ff";

exports.items = [
	{
		label: "Blue / Green",
		opts: {
			"top_colour_black": exports.blue,
			"top_colour_white": exports.blue,
			"off_colour_black": exports.green,
			"off_colour_white": exports.green,
		},
	},
	{
		label: "Blue / Green (brighter)",
		opts: {
			"top_colour_black": exports.blue_bright,
			"top_colour_white": exports.blue_bright,
			"off_colour_black": exports.green_bright,
			"off_colour_white": exports.green_bright,
		},
	},
	{
		type: "separator"
	},
	{
		label: "Green / Yellow",
		opts: {
			"top_colour_black": exports.green,
			"top_colour_white": exports.green,
			"off_colour_black": exports.yellow,
			"off_colour_white": exports.yellow,
		},
	},
	{
		label: "Green / Yellow (brighter)",
		opts: {
			"top_colour_black": exports.green_bright,
			"top_colour_white": exports.green_bright,
			"off_colour_black": exports.yellow_bright,
			"off_colour_white": exports.yellow_bright,
		},
	},
	{
		type: "separator"
	},
	{
		label: "Green / Blue",
		opts: {
			"top_colour_black": exports.green,
			"top_colour_white": exports.green,
			"off_colour_black": exports.blue,
			"off_colour_white": exports.blue,
		},
	},
	{
		label: "Green / Blue (brighter)",
		opts: {
			"top_colour_black": exports.green_bright,
			"top_colour_white": exports.green_bright,
			"off_colour_black": exports.blue_bright,
			"off_colour_white": exports.blue_bright,
		},
	},
	{
		type: "separator"
	},
	{
		label: "Blue / Red",
		opts: {
			"top_colour_black": exports.blue,
			"top_colour_white": exports.blue,
			"off_colour_black": exports.red,
			"off_colour_white": exports.red,
		},
	},
	{
		type: "separator"
	},
	{
		label: "Blue",
		opts: {
			"top_colour_black": exports.blue,
			"top_colour_white": exports.blue,
			"off_colour_black": exports.blue,
			"off_colour_white": exports.blue,
		},
	},
	{
		label: "Green",
		opts: {
			"top_colour_black": exports.green,
			"top_colour_white": exports.green,
			"off_colour_black": exports.green,
			"off_colour_white": exports.green,
		},
	},
	{
		label: "Red",
		opts: {
			"top_colour_black": exports.red,
			"top_colour_white": exports.red,
			"off_colour_black": exports.red,
			"off_colour_white": exports.red,
		}
	},
	{
		type: "separator"
	},
	{
		label: "Rainbow",
		opts: {
			"top_colour_black": exports.blue,
			"top_colour_white": exports.green,
			"off_colour_black": exports.red,
			"off_colour_white": exports.yellow,
		}
	},

];
