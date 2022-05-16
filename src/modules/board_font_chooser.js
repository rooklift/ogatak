"use strict";

// This module lets us input a square size and get an appropriate font.

module.exports = {

	font_size_lookups_big: precompute_font_sizes("999"),
	font_size_lookups_small: precompute_font_sizes("1999"),

	get_small(square_size) {
		if (square_size < 0) square_size = 0;
		if (square_size >= this.font_size_lookups_small.length) square_size = this.font_size_lookups_small.length - 1;
		return this.font_size_lookups_small[square_size].toString() + "px Arial";
	},

	get_big(square_size) {
		if (square_size < 0) square_size = 0;
		if (square_size >= this.font_size_lookups_big.length) square_size = this.font_size_lookups_big.length - 1;
		return this.font_size_lookups_big[square_size].toString() + "px Arial";
	},
};

function precompute_font_sizes(text) {

	let c = document.createElement("canvas");
	c.width = 256;
	c.height = 256;
	let ctx = c.getContext("2d");

	let widths = [0];

	for (let f = 1; f < 128; f++) {
		ctx.font = `${f}px Arial`;
		widths.push(ctx.measureText(text).width);
	}

	let choose_font_size = (ss) => {
		for (let f = 0; f < widths.length; f++) {
			if (widths[f] > ss * 0.61) {
				return f;
			}
		}
		return widths.length;
	}

	let ret = [];

	for (let ss = 0; ss < 512; ss++) {
		ret.push(choose_font_size(ss));
	}

	return ret;
}