"use strict"

function init() {
	return Object.assign(Object.create(mode_selector_prototype), {
		mode: "",
	});
}

let mode_selector_prototype = {

	set_mode: function(mode) {
		if (typeof mode !== "string") mode = "";
		this.mode = mode;
		// FIXME - do whatever drawing of our buttons is needed.
	}

};



module.exports = init();
