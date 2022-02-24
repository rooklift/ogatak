"use strict";

// Charset notes:
//
// The parser assumes UTF-8. However, if it encounters a CA property on its very first call,
// it will throw a specific error and then we decode the **entire file** from that charset and
// turn it into UTF-8, then start again.
//
// This will likely fail if there is a multigame file with differing charsets, but that's weird.

const decoders = require("./decoders");
const new_node = require("./node");
const new_byte_pusher = require("./byte_pusher");

// ------------------------------------------------------------------------------------------------

function load_sgf(buf) {

	// Always returns at least 1 game; or throws if it cannot.

	let ret = [];
	let off = 0;
	let allow_charset_reset = true;		// This is true only for the very first call to load_sgf_recursive().

	// Rarely the encoding will be obvious from initial byte-order marks...

	if (buf.length > 3) {
	 	if (buf[0] === 239 && buf[1] === 187 && buf[2] === 191) {				// Presumably a UTF-8 file (which is what we want anyway).
			buf = buf.slice(3);													// Skip the UTF-8 BOM. Note that slice() references the same memory.
			allow_charset_reset = false;
		} else if (buf[0] === 255 && buf[1] === 254) {							// Presumably a UTF-16LE file. Should be rare in the wild.
			buf = convert_buf(buf, "utf-16le");
			allow_charset_reset = false;
		}
	}

	while (buf.length - off > 0) {
		try {
			let o = load_sgf_recursive(buf, off, null, allow_charset_reset);
			ret.push(o.root);
			off += o.readcount;
		} catch (err) {
			if (typeof err === "object" && err !== null && err.charset) {		// The function threw an object indicating the charset. Only possible for 1st call.
				buf = convert_buf(buf, err.charset);							// The thrower already checked that the charset is valid, so we can call this OK.
			} else if (ret.length > 0) {
				break;															// Break the while loop.
			} else {
				throw err;
			}
		} finally {
			allow_charset_reset = false;
		}
	}

	if (ret.length === 0) {
		throw "SGF load error: found no game";
	}

	for (let root of ret) {
		apply_basic_props_fix(root);
		apply_komi_fix(root);
		apply_pl_fix(root);
	}

	return ret;
}

function load_sgf_recursive(buf, off, parent_of_local_root, allow_charset_reset) {

	let root = null;
	let node = null;
	let tree_started = false;
	let inside_value = false;

	let value = new_byte_pusher("UTF-8");
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
				let key_string = key.string();
				let value_string = value.string();
				node.add_value(key_string, value_string);
				// See notes on character sets, above...
				if (allow_charset_reset && key_string === "CA" && node.props.CA.length === 1) {
					if (!is_utf8_alias(value_string) && decoders.available(value_string)) {
						throw {charset: value_string};
					}
				}
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
				if ((key_string === "B" || key_string === "W") && (node.has_key("B") || node.has_key("W"))) {
					throw `SGF load error: multiple moves in node`;
				}
			} else if (c === 40) {						// that is (
				if (!node) {
					throw "SGF load error: new subtree started but node was nil";
				}
				i += load_sgf_recursive(buf, i, node, false).readcount - 1;
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

function apply_basic_props_fix(root) {
	root.set("GM", 1);
	root.set("FF", 4);
	root.set("CA", "UTF-8");
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

	if (root.has_key("PL") || root.has_key("B") || root.has_key("W") || root.children.length === 0) {
		return;
	}

	let node = root.children[0];

	if (node.has_key("W") && !node.has_key("B")) {
		root.set("PL", "W");
	}
}

function is_utf8_alias(s) {
	s = s.toLowerCase();
	return s === "utf8" || s === "utf-8" || s === "ascii" || s === "us-ascii";		// I guess.
}

function convert_buf(buf, source_encoding) {

	// Converts a buffer from some encoding to a UTF-8 encoded buffer.

	let decoder = decoders.get_decoder(source_encoding);		// This can throw if source_encoding is not supported.
	let s = decoder.decode(buf);
	let ret = Buffer.from(s, "UTF-8");
	return ret;
}

module.exports = load_sgf;
