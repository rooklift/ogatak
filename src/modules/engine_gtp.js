"use strict";

// My initial plan is to have our GTP engine object have the same API
// as the normal one, including storing .running and .desired queries
// in the normal object format.
//
// When it comes to actually sending and receiving, we will convert
// to and from the object / string formats.
//
// We should also:
// - Store what commands are available
// - Store the current boardsize and komi

function new_engine() {
	// TODO
}



module.exports = new_engine;
