"use strict";

const {ipcRenderer} = require("electron");

const config_io = require("./config_io");
const stringify = require("./stringify");

config_io.load();
config_io.create_if_needed();

// ---------------------------------------------------------------------------------------------------
// Explicitly add only the globals we need...

global.alert = (msg) => {							// Do this first.
	ipcRenderer.send("alert", stringify(msg));
};

global.config = config_io.config;					// Do this second. e.g. because new_hub() uses it.
global.save_config = config_io.save;

global.hub = require("./hub").new_hub();

// ---------------------------------------------------------------------------------------------------

require("./__start_handlers");

// ---------------------------------------------------------------------------------------------------

hub.new_game(19, 19);
hub.tabber.draw_tabs(hub.node);
hub.window_resize_checker();
hub.graph_draw_spinner();
hub.active_tab_draw_spinner();

// ---------------------------------------------------------------------------------------------------

ipcRenderer.send("renderer_ready", null);
