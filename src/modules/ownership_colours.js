"use strict"

const {float_to_hex_ff} = require("./utils");

let black_vals = [];
let white_vals = [];

for (let n = 0; n < 256; n++) {
	let own = n / 255;
	let alphahex = float_to_hex_ff(own / 2);
	black_vals.push("#000000" + alphahex);
	white_vals.push("#ffffff" + alphahex);
}

exports.get_draw1_val = function(own) {			// Where own is in range -1..1 from Black's POV			// FIXME change name

	own *= 255;

	if (own < 0) {
		if (own < -255) own = -255;
		return white_vals[Math.floor(-own)];
	} else {
		if (own > 255) own = 255;
		return black_vals[Math.floor(own)];
	}
}


