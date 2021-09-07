"use strict";

// Just to avoid unneeded creation of duplicate decoders,
// we here keep track of what we've made and reuse them.

const util = require("util");

module.exports = {

	decoders: {},

	get_decoder: function(encoding) {

		if (this.decoders[encoding] === undefined) {
			this.decoders[encoding] = new util.TextDecoder(encoding);		// This can throw if encoding is not supported.
		}

		return this.decoders[encoding];

	},

	available: function(encoding) {

		try {
			this.get_decoder(encoding);
			return true;
		} catch (err) {
			return false;
		}
	},

};

