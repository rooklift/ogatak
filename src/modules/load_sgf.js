"use strict";

// Charset notes:
//
// The parser works on a Buffer of bytes and assumes that values -- i.e. things between [ and ] -- are
// encoded with UTF-8. However, if it encounters a CA property on its very first call, it will throw a
// specific error and then we decode the **entire file** from that charset and encode it into UTF-8,
// then start again.
//
// This will likely fail if there is a multigame file with differing charsets, but that's weird.
//
// Note that we can't "simply" decode values with the correct decoder, because the file encoding
// could affect *where the values end* because of ] bytes in multibyte characters in some charsets.
// Thus we do need to decode the file and encode it back to UTF-8 (which is safe from such issues).

const decoders = require("./decoders");
const new_load_results = require("./loader_results");
const new_node = require("./node");
const new_byte_pusher = require("./byte_pusher");

// ------------------------------------------------------------------------------------------------

function load_sgf(buf) {

	let ret = new_load_results();

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

	while (true) {
		try {
			let o = load_sgf_recursive(buf, off, null, allow_charset_reset);
			if (o === null) {													// Reached EOF.
				break;
			} else {
				ret.add_roots(o.root);
				off = o.offset + 1;
			}
		} catch (err) {
			if (typeof err === "object" && err !== null && err.charset) {		// The function threw an object indicating the charset. Only possible for 1st call.
				console.log(`load_sgf(): converting buf from ${err.charset}`);
				buf = convert_buf(buf, err.charset);							// The thrower already checked that the charset is valid, so we can call this OK.
			} else {
				ret.add_errors(err);
				break;
			}
		}
		allow_charset_reset = false;
	}

	if (ret.count_roots() === 0 && ret.count_errors() === 0 && ret.count_size_rejections() === 0) {
		ret.add_errors("SGF load error: found no game");
	}

	for (let root of ret.get_roots()) {
		root.set("GM", 1);
		root.set("FF", 4);
		root.set("CA", "UTF-8");
	}

	return ret;
}

function load_sgf_recursive(buf, i, parent_of_local_root, allow_charset_reset) {

	let root = null;
	let node = null;
	let tree_started = false;
	let inside_value = false;

	let value = new_byte_pusher("UTF-8");
	let key = new_byte_pusher("ascii");
	let keycomplete = false;

	for ( ; i < buf.length; i++) {

		let c = buf[i];

		if (!tree_started) {
			if (c <= 32) {
				continue;
			} else if (c === 40) {						// that is (
				tree_started = true;
				continue;
			} else {
				throw new Error("SGF load error: unexpected byte before (");
			}
		}

		if (inside_value) {

			if (c === 92) {								// that is \
				if (buf.length <= i + 1) {
					throw new Error("SGF load error: escape character at end of input");
				}
				let next = buf[++i];					// Read the next char now.
				if (next === 10) {						// escaped LF linebreak: ignore
					// pass
				} else if (next === 13) {				// escape CR linebreak: ignore (and check if it's CRLF)
					if (buf.length > i + 1 && buf[i + 1] === 10) {
						i++;
					}
				} else {
					value.push(next);
				}
			} else if (c === 93) {						// that is ]
				inside_value = false;
				let key_string = key.string();
				let value_string = value.string();
				node.add_value(key_string, value_string);
				// See notes on character sets, above...
				if (allow_charset_reset && key_string === "CA") {
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
				if (!root) {
					// The tree has ( but no ; before its first property.
					// We tolerate this.
					root = new_node(parent_of_local_root);
					node = root;
				}
				value.reset();
				inside_value = true;
				keycomplete = true;
				let key_string = key.string();
				if (key_string === "") {
					throw new Error(`SGF load error: value started with [ but key was ""`);
				}
				if ((key_string === "B" || key_string === "W") && (node.has_key("B") || node.has_key("W"))) {
					// This is illegal, so we used to throw... but we can tolerate it.
					// throw new Error(`SGF load error: multiple moves in node`);
					node = new_node(node);
				}
			} else if (c === 40) {						// that is (
				if (!node) {
					throw new Error("SGF load error: new subtree started but node was nil");
				}
				i = load_sgf_recursive(buf, i, node, false).offset;
				// We don't add 1 because our loop will do i++ now.
			} else if (c === 41) {						// that is )
				if (!root) {
					throw new Error("SGF load error: subtree ended but local root was nil");
				}
				return {root: root, offset: i};
			} else if (c === 59) {						// that is ;
				if (!root) {
					root = new_node(parent_of_local_root);
					node = root;
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
				throw new Error("SGF load error: unacceptable byte while expecting key");
			}
		}
	}

	// We reached EOF... if we already read some data, this is an error, otherwise it's OK...

	if (parent_of_local_root || root) {
		throw new Error("SGF load error: reached EOF while parsing");
	} else {
		return null;
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
