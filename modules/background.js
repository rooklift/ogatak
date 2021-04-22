"use strict";

exports.Background = function(width, height, square_size) {

	let c = document.createElement("canvas");

	c.width = square_size * width;
	c.height = square_size * height;
	let ctx = c.getContext("2d");

	ctx.lineWidth = 1;
	ctx.strokeStyle = "#000000";

	for (let x = 0; x < width; x++) {

		let x1 = (x * square_size) + (square_size / 2) + 0.5;
		let y1 = (square_size / 2) + 0.5;
		let y2 = (height * square_size) - (square_size / 2) + 0.5;

		ctx.beginPath();
		ctx.moveTo(x1, y1);
		ctx.lineTo(x1, y2);
		ctx.stroke();

	}

	for (let y = 0; y < height; y++) {

		let y1 = (y * square_size) + (square_size / 2) + 0.5;
		let x1 = (square_size / 2) + 0.5;
		let x2 = (width * square_size) - (square_size / 2) + 0.5;

		ctx.beginPath();
		ctx.moveTo(x1, y1);
		ctx.lineTo(x2, y1);
		ctx.stroke();

	}

	return `url("${c.toDataURL("image/png")}")`;
}
