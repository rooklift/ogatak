"use strict";

const {ipcRenderer} = require("electron");
const stringify = require("./stringify");

const config_io = require("./config_io");		// Creates global.config
config_io.load();								// Populates global.config
config_io.create_if_needed();					// Saves config.json if it doesn't exist

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
global.fullbox = require("./fullbox");

hub.new_game(19, 19);
tabber.draw_tabs(hub.node);

require("./__start_handlers");
require("./__start_spinners");

if (config_io.error()) {
	fullbox.warn_bad_config();
}

ipcRenderer.send("renderer_ready", null);

require("./config_wood_fixer");					// Questionable solution to config.wood_colour not matching the board
