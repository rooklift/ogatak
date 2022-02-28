"use strict";

// Exports a function which returns an image (as data URL) of the
// board's gridlines (and hoshi points) on a transparent background.

const {handicap_stones} = require("./utils");

module.exports = function(width, height, square_size, board_line_width, grid_colour) {

	let c = document.createElement("canvas");

	c.width = square_size * width;
	c.height = square_size * height;
	let ctx = c.getContext("2d");

	ctx.lineWidth = board_line_width;
	ctx.strokeStyle = grid_colour;
	ctx.fillStyle = grid_colour;

	let offset = 0;

	if ((board_line_width + square_size) % 2 === 1) {
		offset = 0.5;
	}

	for (let x = 0; x < width; x++) {

		let x1 = (x * square_size) + (square_size / 2) + offset;
		let y1 = (square_size / 2) + offset;
		let y2 = (height * square_size) - (square_size / 2) + offset;

		ctx.beginPath();
		ctx.moveTo(x1, y1);
		ctx.lineTo(x1, y2);
		ctx.stroke();

	}

	for (let y = 0; y < height; y++) {

		let y1 = (y * square_size) + (square_size / 2) + offset;
		let x1 = (square_size / 2) + offset;
		let x2 = (width * square_size) - (square_size / 2) + offset;

		ctx.beginPath();
		ctx.moveTo(x1, y1);
		ctx.lineTo(x2, y1);
		ctx.stroke();

	}

	let hoshi = handicap_stones(Math.min(width, height) > 13 ? 9 : 5, width, height, false);

	for (let s of hoshi) {
		let x = s.charCodeAt(0) - 97;
		let y = s.charCodeAt(1) - 97;
		let gx = (x * square_size) + (square_size / 2) + offset;
		let gy = (y * square_size) + (square_size / 2) + offset;
		ctx.beginPath();
		ctx.arc(gx, gy, board_line_width * 2, 0, 3 * Math.PI);
		ctx.fill();
	}

	return c.toDataURL("image/png");
};
