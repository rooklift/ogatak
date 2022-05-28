"use strict";

let c = document.createElement("canvas");
let ctx = c.getContext("2d");

let c2 = document.createElement("canvas");
let ctx2 = c2.getContext("2d");

module.exports = function(square_size, board_line_width, grid_colour) {

	let ret = {};

	c.width = square_size * 3;
	c.height = square_size * 3;
	
	ctx.lineWidth = board_line_width;
	ctx.strokeStyle = grid_colour;
	ctx.fillStyle = grid_colour;

	let offset = ((board_line_width + square_size) % 2 === 1) ? 0.5 : 0;

	for (let x = 0; x < 3; x++) {

		let x1 = (x * square_size) + (square_size / 2) + offset;
		let y1 = (square_size / 2) + offset;
		let y2 = (3 * square_size) - (square_size / 2) + offset;

		ctx.beginPath();
		ctx.moveTo(x1, y1);
		ctx.lineTo(x1, y2);
		ctx.stroke();

	}

	for (let y = 0; y < 3; y++) {

		let y1 = (y * square_size) + (square_size / 2) + offset;
		let x1 = (square_size / 2) + offset;
		let x2 = (3 * square_size) - (square_size / 2) + offset;

		ctx.beginPath();
		ctx.moveTo(x1, y1);
		ctx.lineTo(x2, y1);
		ctx.stroke();
	}

	let ss = square_size;

	ret.topleft = get_image_url(0, 0, ss);
	ret.top = get_image_url(1, 0, ss);
	ret.topright = get_image_url(2, 0, ss);
	ret.left = get_image_url(0, 1, ss);
	ret.mid = get_image_url(1, 1, ss);
	ret.right = get_image_url(2, 1, ss);
	ret.bottomleft = get_image_url(0, 2, ss);
	ret.bottom = get_image_url(1, 2, ss);
	ret.bottomright = get_image_url(2, 2, ss);

	let gx = square_size + (square_size / 2) + offset;
	let gy = square_size + (square_size / 2) + offset;
	ctx.beginPath();
	ctx.arc(gx, gy, board_line_width * 2, 0, 3 * Math.PI);
	ctx.fill();

	ret.hoshi = get_image_url(1, 1, ss);

	return ret;
}

function get_image_url(x, y, square_size) {

	let img_data = ctx.getImageData(x * square_size, y * square_size, square_size, square_size);

	c2.width = square_size;						// Clearing
	c2.height = square_size;					// the canvas
	
	ctx2.putImageData(img_data, 0, 0);
	return c2.toDataURL("image/png");
}

