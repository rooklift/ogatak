"use strict";

// Strings should be given in #rrggbbaa format (no shorthand like "red").
// Note that transparent colours (with alpha 00) are treated specially by the drawing code (and never get their alpha adjusted).

exports.red = "#ff7777ff";
exports.blue = "#77ddddff";
exports.green = "#99dd55ff";
exports.yellow = "#dddd55ff";
exports.purple = "#d2b4deff";

exports.blue_bright = "#77eeffff";
exports.green_bright = "#99ff55ff";
exports.yellow_bright = "#ffff55ff";

exports.clear = "#00000000";

exports.items = [
	{
		label: "Blue + Green",
		opts: {
			"top_colour_black": exports.blue,
			"top_colour_white": exports.blue,
			"off_colour_black": exports.green,
			"off_colour_white": exports.green,
		},
	},
	{
		label: "Green + Yellow",
		opts: {
			"top_colour_black": exports.green,
			"top_colour_white": exports.green,
			"off_colour_black": exports.yellow,
			"off_colour_white": exports.yellow,
		},
	},
	{
		label: "Green + Blue",
		opts: {
			"top_colour_black": exports.green,
			"top_colour_white": exports.green,
			"off_colour_black": exports.blue,
			"off_colour_white": exports.blue,
		},
	},
	{
		label: "Blue + Red",
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
		label: "Blue + Green (brighter)",
		opts: {
			"top_colour_black": exports.blue_bright,
			"top_colour_white": exports.blue_bright,
			"off_colour_black": exports.green_bright,
			"off_colour_white": exports.green_bright,
		},
	},
	{
		label: "Green + Yellow (brighter)",
		opts: {
			"top_colour_black": exports.green_bright,
			"top_colour_white": exports.green_bright,
			"off_colour_black": exports.yellow_bright,
			"off_colour_white": exports.yellow_bright,
		},
	},
	{
		label: "Green + Blue (brighter)",
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
		label: "Blue + Transparent",
		opts: {
			"top_colour_black": exports.blue,
			"top_colour_white": exports.blue,
			"off_colour_black": exports.clear,
			"off_colour_white": exports.clear,
		},
	},
	{
		label: "Green + Transparent",
		opts: {
			"top_colour_black": exports.green,
			"top_colour_white": exports.green,
			"off_colour_black": exports.clear,
			"off_colour_white": exports.clear,
		},
	},
	
	{
		label: "Red + Transparent",
		opts: {
			"top_colour_black": exports.red,
			"top_colour_white": exports.red,
			"off_colour_black": exports.clear,
			"off_colour_white": exports.clear,
		}
	},
	{
		type: "separator"
	},
	{
		label: "Red vs Purple",
		opts: {
			"top_colour_black": exports.red,
			"top_colour_white": exports.purple,
			"off_colour_black": exports.red,
			"off_colour_white": exports.purple,
		}
	},
	{
		label: "BlueRed vs GreenYellow",
		opts: {
			"top_colour_black": exports.blue,
			"top_colour_white": exports.green,
			"off_colour_black": exports.red,
			"off_colour_white": exports.yellow,
		}
	},
	{
		type: "separator"
	},
	{
		label: "Transparent",
		opts: {
			"top_colour_black": exports.clear,
			"top_colour_white": exports.clear,
			"off_colour_black": exports.clear,
			"off_colour_white": exports.clear,
		}
	},
	

];
