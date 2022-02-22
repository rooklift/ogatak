"use strict";

// The gridder has display: none to start with, so that it's not drawn until the script is active.
// Probably best to do this at the very start, so calculated styles etc work...

document.getElementById("gridder").style["display"] = "grid";

// And then this does everything:

require("./modules/__start");
