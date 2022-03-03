"use strict"

const {float_to_hex_ff} = require("./utils");

let black_vals = [];
let white_vals = [];
let black_blends = null;
let white_blends = null;

for (let n = 0; n < 256; n++) {
	let own = n / 255;
	let alphahex = float_to_hex_ff(own / 2.5);
	black_vals.push("#000000" + alphahex);
	white_vals.push("#ffffff" + alphahex);
}

exports.get_precomputed_vals = function(own) {		// Where own is in range -1..1 from Black's POV

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

exports.precompute = function(wood_colour) {

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

			target_array.push("#" + rgb[0].toString(16) + rgb[1].toString(16) + rgb[2].toString(16) + "ff");
		}
	}
};

exports.precompute(config.wood_colour);
