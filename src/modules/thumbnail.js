"use strict";

module.exports = function(board, square_size) {

	if (!board) {
		throw new Error("thumbnail.js: board must be valid");
	}

	let c = document.createElement("canvas");

	c.width = square_size * Math.max(19, board.width);
	c.height = square_size * Math.max(19, board.height);

	let visible_x_width = square_size * board.width;
	let visible_y_height = square_size * board.height;

	let x_offset = (c.width / 2) - (visible_x_width / 2);
	let y_offset = (c.height / 2) - (visible_y_height / 2);

	let ctx = c.getContext("2d");

	ctx.fillStyle = config.wood_colour;
	ctx.beginPath();
	ctx.rect(x_offset, y_offset, visible_x_width, visible_y_height);
	ctx.fill();

	for (let x = 0; x < board.width; x++) {

		for (let y = 0; y < board.height; y++) {

			if (board.state[x][y]) {

				let gx = x * square_size + (square_size / 2) + x_offset;
				let gy = y * square_size + (square_size / 2) + y_offset;

				ctx.fillStyle = board.state[x][y] === "b" ? "#000000ff" : "#ffffffff";
				ctx.lineWidth = 0;

				ctx.beginPath();
				ctx.arc(gx, gy, (square_size / 2 - square_size * 0.1), 0, 2 * Math.PI);
				ctx.fill();
			}
		}
	}

	return {
		data: c.toDataURL("image/png"),
		width: c.width,						// We return the sizes because, when the img src is set by the caller, there will be a brief moment where
		height: c.height					// the layout engine doesn't know the sizes, causing flicker, which we avoid by setting img.width / height.
	};
};
