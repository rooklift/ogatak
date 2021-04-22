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

	if (width === 19 && height === 19) {			// FIXME
		for (let x = 3; x < 19; x += 6) {
			for (let y = 3; y < 19; y += 6) {
				let x1 = (x * square_size) + (square_size / 2) + 0.5;
				let y1 = (y * square_size) + (square_size / 2) + 0.5;
				ctx.beginPath();
				ctx.arc(x1, y1, 2, 0, 3 * Math.PI);
				ctx.fill();
			}
		}
	}

	return `url("${c.toDataURL("image/png")}")`;
}
