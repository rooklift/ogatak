"use strict";

const fs = require("fs");

// Although JS stores strings internally as UTF-16 or something, Node's writeFileSync()
// uses UTF-8 by default. So all our output files are UTF-8.

function save_sgf(node, filepath) {
	try {
		fs.writeFileSync(filepath, tree_string(node));
	} catch (err) {
		alert(err);
	}
}

function tree_string(node) {
	return __tree_string(node.get_root());
}

function __tree_string(node) {
	let list = [];
	list.push("(");
	while (true) {
		list.push(node.string());
		if (node.children.length > 1) {
			for (let child of node.children) {
				list.push(__tree_string(child));
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

function save_sgf_multi(nodes, filepath) {
	try {
		let list = [];
		for (let node of nodes) {
			list.push(tree_string(node));
		}
		fs.writeFileSync(filepath, list.join("\n\n"));
	} catch (err) {
		alert(err);
	}
}



module.exports = {save_sgf, save_sgf_multi, tree_string};
