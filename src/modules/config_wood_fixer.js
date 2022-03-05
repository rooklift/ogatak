"use strict";

// We want our config.wood_colour value to actually match the board in use.
// This is a slightly dubious way to make sure that is so.

const {int_to_hex_ff} = require("./utils");

function get_average_colour(img) {

	// From https://github.com/matkl/average-color -- MIT License

	let c = document.createElement("canvas");
	c.width = img.naturalWidth;
	c.height = img.naturalHeight;

	let ctx = c.getContext("2d");
	ctx.drawImage(img, 0, 0);

	let data = ctx.getImageData(0, 0, c.width, c.height).data;
	let r = 0;
	let g = 0;
	let b = 0;

	for (let i = 0; i < data.length; i += 4) {
		r += data[i + 0];
		g += data[i + 1];
		b += data[i + 2];
	}

	r = Math.floor(r / (data.length / 4));
	g = Math.floor(g / (data.length / 4));
	b = Math.floor(b / (data.length / 4));

	return "#" + int_to_hex_ff(r) + int_to_hex_ff(g) + int_to_hex_ff(b) + "ff";
}

// Do it....

let img = new Image();
img.addEventListener("load", () => {
	let avg = get_average_colour(img);
	if (avg !== config.wood_colour) {
		console.log(`config.wood_colour === "${config.wood_colour}" but img average === "${avg}", fixing...`);
		hub.set("wood_colour", avg);
	}
});
img.src = "./gfx/subdued_board.png";
