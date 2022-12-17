"use strict";

const fs = require("fs");

// Notes: the logger maintains some state, specifically the open write stream and a filepath associated with it.
// In the event of an error, the stream is invalidated, but the filepath remains cached as is, meaning future
// log messages for that filepath are absorbed but not actually logged anywhere. This is the desired behaviour.

let logger = {

	stream: null,
	filepath: null,

	log: function(filepath, s) {

		// Case where given filepath is invalid...

		if (typeof filepath !== "string" || filepath === "") {
			this.close();
			return;
		}

		// Case where given filepath is valid but doesn't match our filepath...

		if (filepath !== this.filepath) {
			this.close();
			this.open(filepath);
		}

		// See notes at top for why this.stream might be null even when this.filepath is OK...

		if (this.stream) {
			this.stream.write(s + "\n");
		}
	},

	close: function() {
		if (this.stream) {
			console.log(`Closing ${this.filepath}`);
			this.stream.end();
		}
		this.stream = null;
		this.filepath = null;
	},

	handle_error: function(stream, err) {
		console.log(err);
		stream.end();
		if (stream === this.stream) {				// Might not be so, due to race conditions etc.
			this.stream = null;						// We don't adjust this.filepath, see notes at top for why.
		}
	},

	open: function(filepath) {

		console.log(`Logging to ${filepath}`);

		let new_stream = fs.createWriteStream(filepath, {flags: "a"});		// This doesn't throw on bad filepath, but rather generates an error soon-ish.
		new_stream.on("error", (err) => {
			this.handle_error(new_stream, err);
		});

		this.stream = new_stream;
		this.filepath = filepath;
	},
}



function log(s) {
	logger.log(config.logfile, s);
}

module.exports = log;

