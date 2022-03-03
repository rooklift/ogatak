"use strict"

// For the ownership map, we are interested in two different colours:
//
// -- What colour to draw to the ownership canvas.
// -- What the resulting colour of the wood is.
//
// The latter is the troublesome thing but is kind of needed because we draw
// "wood" colour at certain moments in the board_drawer, which therefore needs
// to have a cached value of the true colour being displayed.

const {float_to_hex_ff, int_to_hex_ff} = require("./utils");

let black_vals = []; let black_blends = null;
let white_vals = []; let white_blends = null;

for (let n = 0; n < 256; n++) {
	let own = n / 255;
	let alphahex = float_to_hex_ff(own / 2.5);
	black_vals.push("#000000" + alphahex);
	white_vals.push("#ffffff" + alphahex);
}

exports.precompute_ownership_colours = function(wood_colour) {

	let c = document.createElement("canvas");

	c.width = 16;
	c.height = 16;
	let ctx = c.getContext("2d");

	black_blends = [];								// Reset any precomputed arrays we already did.
	white_blends = [];

	for (let [array, target_array] of [[black_vals, black_blends], [white_vals, white_blends]]) {

		for (let n = 0; n < 256; n++) {

			ctx.fillStyle = wood_colour;
			ctx.fillRect(0, 0, 16, 16);

			ctx.fillStyle = array[n];
			ctx.fillRect(0, 0, 16, 16);

			let data = ctx.getImageData(8, 8, 1, 1).data;
			let rgb = [data[0], data[1], data[2]];

			target_array.push("#" + int_to_hex_ff(rgb[0]) + int_to_hex_ff(rgb[1]) + int_to_hex_ff(rgb[2]) + "ff");
		}
	}
};

exports.get_ownership_colours = function(own) {		// Where own is in range -1..1 from Black's POV

	// Returns 2 values:
	// -- What colour (pure black or white, but with an alpha) to draw to the ownership canvas.
	// -- What the resulting colour on the screen will be (no alpha, i.e. ends in ff).

	own *= 255;

	if (own < 0) {
		let index = Math.floor(-own);
		if (index > 255) index = 255;
		return [white_vals[index], white_blends[index]];
	} else {
		let index = Math.floor(own);
		if (index > 255) index = 255;
		return [black_vals[index], black_blends[index]];
	}
};


// Do the precompute using the default wood colour.
exports.precompute_ownership_colours(config.wood_colour);
