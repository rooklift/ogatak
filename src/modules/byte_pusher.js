"use strict";

// Exports a function which returns a "byte pusher", which is used to
// store a short sequence of bytes while parsing files. The pusher
// has an associated encoding which is used by its string() method.

const decoders = require("./decoders");

function new_byte_pusher(encoding = "UTF-8", size = 16) {

	return Object.assign(Object.create(byte_pusher_prototype), {
		decoder: decoders.get_decoder(encoding),					// This can throw if encoding is not supported.
		storage: new Uint8Array(size),
		length: 0,													// Both the length and also the next index to write to.
	});

}

let byte_pusher_prototype = {

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



module.exports = new_byte_pusher;