"use strict";

const new_node = require("./node");

const util = require("util");
const decoder = new util.TextDecoder("utf8");

function new_byte_pusher(size) {

	if (!size || size <= 0) {
		size = 16;
	}

	// I bet Node has something like this, but I didn't read the docs.

	return {

		storage: new Uint8Array(size),
		length: 0,							// Both the length and also the next index to write to.

		push: function(c) {
			if (this.length >= this.storage.length) {
				let new_storage = new Uint8Array(this.storage.length * 2);
				for (let n = 0; n < this.storage.length; n++) {
					new_storage[n] = this.storage[n];
				}
				this.storage = new_storage;
			}
			this.storage[this.length] = c;
			this.length++;
		},

		reset: function() {
			this.length = 0;
		},

		bytes: function() {
			return this.storage.slice(0, this.length);
		},

		string: function() {
			return decoder.decode(this.bytes());
		}
	};
}

function load_sgf(buf) {

	// Always returns at least 1 game; or throws if it cannot.

	let ret = [];
	let off = 0;

	while (true) {
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
	}

	return ret;
}

function load_sgf_recursive(buf, off, parent_of_local_root) {

	let root = null;
	let node = null;
	let tree_started = false;
	let inside_value = false;

	let value = new_byte_pusher();
	let key = new_byte_pusher();
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
				if (key.string() === "") {
					throw `SGF load error: value started with [ but key was ""`;
				}
			} else if (c === 40) {						// that is (
				if (!node) {
					throw "SGF load error: new subtree started but node was nil";
				}
				let chars_to_skip = load_sgf_recursive(buf, i, node).readcount;
				i += chars_to_skip - 1;					// Subtract 1: the ( character we have read is also counted by the recurse.
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



module.exports = load_sgf;
