"use strict";

// I bet Node has something like this, but I didn't read the docs.

const util = require("util");

module.exports = function(encoding = "utf8", size = 16) {

	return {

		storage: new Uint8Array(size),
		length: 0,									// Both the length and also the next index to write to.

		decoder: new util.TextDecoder(encoding),	// This can throw.

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
			return this.decoder.decode(this.bytes());
		}
	};
};
