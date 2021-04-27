"use strict";

const NewNode = require("./node").NewNode;
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

exports.Load = function(sgf, off, parent_of_local_root) {

	let root = null;
	let node = null;
	let tree_started = false;
	let inside_value = false;

	let value = new_byte_pusher();
	let key = new_byte_pusher();
	let keycomplete = false;

	for (let i = off; i < sgf.length; i++) {

		let c = sgf[i];

		if (tree_started === false) {
			if (c <= 32) {
				continue;
			} else if (c === 40) {						// that is (
				tree_started = true;
				continue;
			} else {
				throw "SGF Load() error: unexpected byte before (";
			}
		}

		if (inside_value) {

			if (c === 92) {								// that is \
				if (sgf.length <= i + 1) {
					throw "SGF Load() error: escape character at end of input";
				}
				value.push(sgf[i + 1]);
				i++;
			} else if (c === 93) {						// that is ]
				inside_value = false;
				if (!node) {
					throw "SGF Load() error: value ended by ] but node was nil";
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
					node = NewNode(parent_of_local_root);
					root = node;
				}
				value.reset();
				inside_value = true;
				keycomplete = true;
				if (key.string() === "") {
					throw "SGF Load() error: value started with [ but key was \"\"";
				}
			} else if (c === 40) {						// that is (
				if (!node) {
					throw "SGF Load() error: new subtree started but node was null";
				}
				let chars_to_skip = exports.Load(sgf, i, node)[1];
				i += chars_to_skip - 1;					// Subtract 1: the ( character we have read is also counted by the recurse.
			} else if (c === 41) {						// that is )
				if (!root) {
					throw "SGF Load() error: subtree ended but local root was null";
				}
				return [root, i + 1 - off];
			} else if (c === 59) {						// that is ;
				if (!node) {
					node = NewNode(parent_of_local_root);
					root = node;
				} else {
					node = NewNode(node);
				}
			} else if (c >= 65 && c <= 90) {
				if (keycomplete) {
					key.reset();
					keycomplete = false;
				}
				key.push(c);
			} else {
				throw "SGF Load() error: unacceptable byte while expecting key";
			}
		}
	}

	if (!root) {
		throw "SGF Load() error: local root was nil at function end";
	}

	// We're not supposed to reach here, but if we do, we have reached the
	// end of the file and can return what we have.

	return [root, sgf.length];
}
