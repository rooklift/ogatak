"use strict";

// Just to avoid unneeded creation of duplicate decoders,
// we here keep track of what we've made and reuse them.

const util = require("util");

module.exports = {

	decoders: Object.create(null),

	get_decoder: function(encoding) {

		// This can throw if encoding is not supported.

		if (this.decoders[encoding] === undefined) {
			this.decoders[encoding] = new util.TextDecoder(encoding);
		}

		return this.decoders[encoding];

	},

	available: function(encoding) {

		// Tests whether it's possible for us to decode the given encoder.
		// If it is, the relevant decoder will be created if it doesn't exist.

		try {
			this.get_decoder(encoding);
			return true;
		} catch (err) {
			return false;
		}
	},

};

