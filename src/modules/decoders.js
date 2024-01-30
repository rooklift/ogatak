"use strict";

// Just to avoid unneeded creation of duplicate decoders,
// we here keep track of what we've made and reuse them.

const util = require("util");

let decoder_cache = Object.create(null);

exports.get_decoder = function(encoding) {

	// This can throw if encoding is not supported.

	if (decoder_cache[encoding] === undefined) {
		decoder_cache[encoding] = new util.TextDecoder(encoding);
	}

	return decoder_cache[encoding];
};

exports.available = function(encoding) {

	// Tests whether it's possible for us to decode the given encoder.
	// If it is, the relevant decoder will be created if it doesn't exist.

	try {
		exports.get_decoder(encoding);
		return true;
	} catch (err) {
		return false;
	}
};
