"use strict";

const {defaults} = require("./config_io");

// Note that the alpha values are ignored (true on 2022-03-02).

module.exports = {

	"Blue / Green": {
		"top_colour_black": "#77ddddff",
		"top_colour_white": "#77ddddff",
		"off_colour_black": "#99dd55ff",
		"off_colour_white": "#99dd55ff",
	},

	"Green / Yellow": {
		"top_colour_black": "#99dd55ff",
		"top_colour_white": "#99dd55ff",
		"off_colour_black": "#dddd55ff",
		"off_colour_white": "#dddd55ff",
	},

/*							// This is bad because it's not actually transparent, which becomes obvious when the backdrop is not wood_colour.
	"Transparent": {
		"top_colour_black": defaults.wood_colour,
		"top_colour_white": defaults.wood_colour,
		"off_colour_black": defaults.wood_colour,
		"off_colour_white": defaults.wood_colour,
	},
*/

};
