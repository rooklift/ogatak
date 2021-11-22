"use strict";

function new_comment_drawer(div) {
	let drawer = Object.create(comment_drawer_prototype);
	drawer.div = div;
	return drawer;
}

let comment_drawer_prototype = {

	draw: function(node) {

		let c = node.get("C");

		if (typeof c !== "string") {
			c = "";
		}

		this.div.innerHTML = c;
	}
};

module.exports = new_comment_drawer;