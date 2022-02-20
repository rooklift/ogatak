"use strict";

const {ipcRenderer} = require("electron");
const {get_href_query_val} = require("./utils");

const config_io = require("./config_io");		// Creates global.config
const stringify = require("./stringify");

config_io.load();								// Populates global.config
config_io.create_if_needed();

// ---------------------------------------------------------------------------------------------------
// The order of events is important...

global.alert = (msg) => {
	ipcRenderer.send("alert", stringify(msg));
};

global.hub = require("./hub");
global.tabber = require("./tabber");
global.board_drawer = require("./board_drawer");
global.grapher = require("./grapher");
global.tree_drawer = require("./tree_drawer");
global.comment_drawer = require("./comment_drawer");

board_drawer.fix_infodiv_font();
comment_drawer.fix_font();

hub.new_game(19, 19);
tabber.draw_tabs(hub.node);

require("./__start_handlers");
require("./__start_spinners");

if (config_io.error()) {
	alert(`${config_io.filename} failed to load. It will not be saved to until you fix this. Error:\n` + config_io.error());
}

ipcRenderer.send("renderer_ready", null);
