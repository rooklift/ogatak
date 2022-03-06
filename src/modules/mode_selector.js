"use strict"

function init() {
	return Object.assign(Object.create(mode_selector_prototype), {
		canvas: document.getElementById("mode"),
		ctx: document.getElementById("mode").getContext("2d"),
		mode: "",
	});
}

let mode_selector_prototype = {

	set_mode: function(mode, node) {				// No potential for confusion here, hmm...
		if (typeof mode !== "string") mode = "";
		this.mode = mode;
	},

	draw: function(node) {
		this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
		this.draw_active(node);
	},

	draw_active: function(node) {

		if (node.get_board().active === "b") {
			this.fcircle(0.65, 0.5, 0.5, "#ffffffff");
			this.fcircle(0.35, 0.5, 0.5, "#ffffffff");
			this.fcircle(0.35, 0.5, 0.45, "#000000ff");
		} else {
			this.fcircle(0.35, 0.5, 0.5, "#ffffffff");
			this.fcircle(0.35, 0.5, 0.45, "#000000ff");
			this.fcircle(0.65, 0.5, 0.5, "#ffffffff");
		}
	},

	fcircle: function(xfraction, yfraction, rfraction, colour) {
		let ctx = this.ctx;
		ctx.fillStyle = colour;
		ctx.beginPath();
		ctx.arc(this.canvas.width * xfraction, this.canvas.height * yfraction, this.canvas.width * rfraction / 2, 0, 2 * Math.PI);
		ctx.fill();
	},


};



module.exports = init();
