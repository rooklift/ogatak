"use strict";

// Exports a function which returns a "byte pusher", which is used to
// store a short sequence of bytes while parsing files. The pusher
// has an associated encoding which is used by its string() method.

const decoders = require("./decoders");

function new_byte_pusher(...args) {
	return new BytePusher(...args);
}

class BytePusher {

	constructor(encoding = "UTF-8", size = 16) {
		this.decoder = decoders.get_decoder(encoding);			// This can throw if encoding is not supported.
		this.storage = new Uint8Array(size);
		this.length = 0;										// Both the length and also the next index to write to.
	}

	push(c) {
		if (this.length >= this.storage.length) {
			let new_storage = new Uint8Array(this.storage.length * 2);
			for (let n = 0; n < this.storage.length; n++) {
				new_storage[n] = this.storage[n];
			}
			this.storage = new_storage;
		}
		this.storage[this.length] = c;
		this.length++;
	}

	reset() {
		this.length = 0;
	}

	bytes() {
		return this.storage.slice(0, this.length);
	}

	string() {
		return this.decoder.decode(this.bytes());
	}
}



module.exports = new_byte_pusher;
