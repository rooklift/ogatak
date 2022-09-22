"use strict";

// This module lets us input a square size and get an appropriate font.

module.exports = {

	font_size_lookups_big: precompute_font_sizes("111"),
	font_size_lookups_medium: precompute_font_sizes("999"),
	font_size_lookups_small: precompute_font_sizes("1111"),

	__get: function(square_size, arr) {
		if (typeof config.board_font_override === "string" && config.board_font_override !== "") {
			return config.board_font_override;
		}
		if (square_size < 0) {
			square_size = 0;
		}
		if (square_size >= arr.length) {
			square_size = arr.length - 1;
		}
		return arr[square_size].toString() + "px Arial";
	},

	get_big: function(square_size) {
		return this.__get(square_size, this.font_size_lookups_big);
	},

	get_medium: function(square_size) {
		return this.__get(square_size, this.font_size_lookups_medium);
	},

	get_small(square_size) {
		return this.__get(square_size, this.font_size_lookups_small);
	},
};



function precompute_font_sizes(text) {

	// Return value will be an array giving lookups for   square_size --> font_size

	let c = document.createElement("canvas");
	let ctx = c.getContext("2d");

	let ret = [];

	for (let f = 0; f < 128; f++) {
		ctx.font = `${f}px Arial`;
		let test_text_width = ctx.measureText(text).width;
		let wants_bigger = Math.floor(test_text_width / 0.59); 			// The first square_size that will be assigned a bigger font_size.
		for (let i = ret.length; i < wants_bigger; i++) {				// So any missing values before that should be set to f.
			ret.push(f);
		}
	}

	return ret;
}
