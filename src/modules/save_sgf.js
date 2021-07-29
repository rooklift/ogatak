"use strict";

const fs = require("fs");

// Although JS stores strings internally as UTF-16 or something, Node's writeFileSync()
// uses UTF-8 by default. So all our output files are UTF-8.

function save_sgf(node, filepath) {
	try {
		fs.writeFileSync(filepath, tree_string(node.get_root()));
	} catch (err) {
		alert(err);
	}
}

function tree_string(node) {

	let list = [];

	list.push("(");

	while (true) {
		list.push(node.string());
		if (node.children.length > 1) {
			for (let child of node.children) {
				list.push(tree_string(child));
			}
			break;
		} else if (node.children.length === 1) {
			node = node.children[0];
			continue;
		} else {
			break;
		}
	}

	list.push(")");

	return list.join("");
}



module.exports = save_sgf;
