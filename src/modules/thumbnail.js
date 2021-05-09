"use strict";

module.exports = function(board, square_size) {

	let c = document.createElement("canvas");

	if (board) {
		c.width = square_size * board.width;
		c.height = square_size * board.height;
	} else {
		c.width = square_size * 19;
		c.height = square_size * 19;
	}

	if (board) {

		let ctx = c.getContext("2d");

		ctx.fillStyle = board ? config.wood_colour : "#000000ff";
		ctx.beginPath();
		ctx.rect(0, 0, c.width, c.height);
		ctx.fill();

		for (let x = 0; x < board.width; x++) {

			for (let y = 0; y < board.height; y++) {

				if (board.state[x][y]) {

					let gx = x * square_size + (square_size / 2);
					let gy = y * square_size + (square_size / 2);

					ctx.fillStyle = board.state[x][y] === "b" ? "#000000ff" : "#ffffffff";
					ctx.lineWidth = 0;

					ctx.beginPath();
					ctx.arc(gx, gy, (square_size / 2 - square_size * 0.1), 0, 2 * Math.PI);
					ctx.fill();
				}
			}
		}

	} else {

		// Uh, nothing.

	}

	return c.toDataURL("image/png");
}
