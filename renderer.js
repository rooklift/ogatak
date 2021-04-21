"use strict";

const config_io = require("./modules/config_io");

let [err, config] = config_io.load();

config_io.create_if_needed(config);
