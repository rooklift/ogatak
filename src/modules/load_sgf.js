"use strict";

const new_node = require("./node");
const new_byte_pusher = require("./byte_pusher");

function load_sgf(buf) {

	// Always returns at least 1 game; or throws if it cannot.

	let ret = [];
	let off = 0;

	while (buf.length - off >= 3) {
		try {
			let o = load_sgf_recursive(buf, off, null);
			ret.push(o.root);
			off += o.readcount;
		} catch (err) {
			if (ret.length > 0) {
				break;
			} else {
				throw err;
			}
		}
	}

	if (ret.length === 0) {
		throw "SGF load error: found no game";
	}

	for (let root of ret) {
		apply_komi_fix(root);
		apply_pl_fix(root);
	}

	return ret;
}

function load_sgf_recursive(buf, off, parent_of_local_root) {

	let root = null;
	let node = null;
	let tree_started = false;
	let inside_value = false;

	let value = new_byte_pusher("utf8");
	let key = new_byte_pusher("ascii");
	let keycomplete = false;

	for (let i = off; i < buf.length; i++) {

		let c = buf[i];

		if (tree_started === false) {
			if (c <= 32) {
				continue;
			} else if (c === 40) {						// that is (
				tree_started = true;
				continue;
			} else {
				throw "SGF load error: unexpected byte before (";
			}
		}

		if (inside_value) {

			if (c === 92) {								// that is \
				if (buf.length <= i + 1) {
					throw "SGF load error: escape character at end of input";
				}
				value.push(buf[i + 1]);
				i++;
			} else if (c === 93) {						// that is ]
				inside_value = false;
				if (!node) {
					throw "SGF load error: value ended by ] but node was nil";
				}
				node.add_value(key.string(), value.string());
			} else {
				value.push(c);
			}

		} else {

			if (c <= 32 || (c >= 97 && c <= 122)) {		// that is a-z
				continue;
			} else if (c === 91) {						// that is [
				if (!node) {
					// The tree has ( but no ; before its first property.
					// We tolerate this.
					node = new_node(parent_of_local_root);
					root = node;
				}
				value.reset();
				inside_value = true;
				keycomplete = true;
				let key_string = key.string();
				if (key_string === "") {
					throw `SGF load error: value started with [ but key was ""`;
				}
				if ((key_string === "B" || key_string === "W") && (node.props.B || node.props.W)) {
					throw `SGF load error: multiple moves in node`;
				}
			} else if (c === 40) {						// that is (
				if (!node) {
					throw "SGF load error: new subtree started but node was nil";
				}
				i += load_sgf_recursive(buf, i, node).readcount - 1;
				// We subtract 1 as the ( character we have read is also counted by the recurse.
			} else if (c === 41) {						// that is )
				if (!root) {
					throw "SGF load error: subtree ended but local root was nil";
				}
				return {root: root, readcount: i + 1 - off};
			} else if (c === 59) {						// that is ;
				if (!node) {
					node = new_node(parent_of_local_root);
					root = node;
				} else {
					node = new_node(node);
				}
				key.reset();
				keycomplete = false;
			} else if (c >= 65 && c <= 90) {			// that is A-Z
				if (keycomplete) {
					key.reset();
					keycomplete = false;
				}
				key.push(c);
			} else {
				throw "SGF load error: unacceptable byte while expecting key";
			}
		}
	}

	throw "SGF load error: reached end of input";
}

function apply_komi_fix(root) {

	// Fix up komi if it is in Chinese counting format like 3.25, 3.75, etc.
	// No need to create it if it's not present, 0 will be inferred.

	let km = parseFloat(root.get("KM")) || 0;

	if (km - Math.floor(km) === 0.75 || km - Math.floor(km) === 0.25) {
		root.set("KM", km * 2);
	}
}

function apply_pl_fix(root) {

	// In some ancient games, white plays first.
	// Add a PL property to the root if so.

	if (root.get("PL") || root.props.B || root.props.W || root.children.length === 0) {
		return;
	}

	let node = root.children[0];

	if (node.get("W") && node.get("B") === undefined) {
		root.set("PL", "W");
	}
}



module.exports = load_sgf;
