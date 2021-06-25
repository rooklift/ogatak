"use strict";

const {ipcRenderer} = require("electron");
const querystring = require("querystring");

const config_io = require("./config_io");
const stringify = require("./stringify");

config_io.load();
config_io.create_if_needed();

// ---------------------------------------------------------------------------------------------------
// Explicitly add only the globals we need...

global.alert = (msg) => {
	ipcRenderer.send("alert", stringify(msg));
};

global.zoomfactor = parseFloat(querystring.parse(global.location.search).zoomfactor);
global.config = config_io.config;
global.save_config = config_io.save;
global.hub = require("./hub").new_hub();

// ---------------------------------------------------------------------------------------------------

require("./__start_handlers");

// ---------------------------------------------------------------------------------------------------

hub.new_game(19, 19);
hub.tabber.draw_tabs(hub.node);
hub.window_resize_checker();
hub.active_tab_draw_spinner();
hub.graph_draw_spinner();
hub.tree_draw_spinner();
hub.mousewheel_spinner();

// ---------------------------------------------------------------------------------------------------

ipcRenderer.send("renderer_ready", null);
