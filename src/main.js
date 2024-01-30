"use strict";

// Remember that prestart.js is run before this.

const electron = require("electron");
const config_io = require("./modules/config_io");					// Creates global.config
config_io.load();													// Populates global.config

// --------------------------------------------------------------------------------------------------------------

let actually_disabled_hw_accel = false;

if (!config.enable_hw_accel) {
	try {
		electron.app.disableHardwareAcceleration();
		actually_disabled_hw_accel = true;
	} catch (err) {
		// pass
	}
}

// --------------------------------------------------------------------------------------------------------------

const path = require("path");
const alert = require("./modules/alert_main");
const colour_choices = require("./modules/colour_choices");
const stringify = require("./modules/stringify");
const {translate, all_languages} = require("./modules/translate");

// --------------------------------------------------------------------------------------------------------------

let win;						// Need to keep global references to every window we make. (Is that still true?)
let menu = menu_build();
let menu_is_set = false;
let have_received_ready = false;
let have_sent_quit = false;
let have_received_terminate = false;
let queued_files = [];
let spacebar_time = 0;			// Contrived workaround allowing us to have these as
let comma_time = 0;				// accelerators without interfering with text editing

// --------------------------------------------------------------------------------------------------------------
// Make note of argv strings which could be files to open...

if (path.basename(process.argv[0]).toLowerCase().includes("electron")) {
	queued_files = process.argv.slice(2);									// Possibly an empty slice
} else {
	queued_files = process.argv.slice(1);									// Possibly an empty slice
}

// We may get second-instance events at any time, which may add more files to open -- handled by queued_files_spinner()

electron.app.on("second-instance", (event, commandLine, workingDirectory, additionalData) => {
	queued_files = queued_files.concat(commandLine.slice(1));
});

// --------------------------------------------------------------------------------------------------------------

electron.app.whenReady().then(() => {					// If "ready" event already happened, whenReady() fulfills immediately.

	let desired_zoomfactor = 1 / electron.screen.getPrimaryDisplay().scaleFactor;

	win = new electron.BrowserWindow({
		width: Math.round(config.width * desired_zoomfactor),
		height: Math.round(config.height * desired_zoomfactor),
		backgroundColor: "#000000",
		resizable: true,
		show: false,
		useContentSize: true,
		webPreferences: {
			backgroundThrottling: false,
			contextIsolation: false,
			nodeIntegration: true,
			spellcheck: false,
			zoomFactor: desired_zoomfactor				// Unreliable? See https://github.com/electron/electron/issues/10572
		}
	});

	win.webContents.on("before-input-event", (event, input) => {
		if (input.type === "keyDown") {
			if (input.code === "Space") {
				spacebar_time = new Date();
			} else if (input.code === "Comma") {
				comma_time = new Date();
			}
		}
	});

	win.on("maximize", (event) => {
		win.webContents.send("set", {maxed: true});
	});

	win.on("unmaximize", (event) => {					// Note that these are not received when a maximized window is minimized.
		win.webContents.send("set", {maxed: false});	// I think they are only received when a maximized window becomes normal.
	});													// So our .maxed var tracks what we are trying to be, when shown at all.

	// Note: even though there is an event called "restore", if we call win.restore() for a minimized window
	// which wants to go back to being maximized, it generates a "maximize" event, not a "restore" event.

	win.on("close", (event) => {						// We used to use .once() but I suppose there's a race condition if two events happen rapidly.

		if (!have_received_terminate) {

			event.preventDefault();						// Only a "terminate" message from the Renderer should close the app.

			if (!have_sent_quit) {
				win.webContents.send("call", "quit");	// Renderer's "quit" method runs. It then sends "terminate" back.
				have_sent_quit = true;
			}

			// Create a setTimeout that will make the app close without the renderer's help if it takes too long (due to a crash)...

			setTimeout(() => {
				console.log("Renderer seems unresponsive, quitting anyway.");
				have_received_terminate = true;
				win.close();
			}, 3000);
		}
	});

	electron.ipcMain.on("terminate", () => {
		have_received_terminate = true;					// Needed so the "close" handler (see above) knows to allow it.
		win.close();
	});

	electron.app.on("window-all-closed", () => {
		electron.app.quit();
	});

	electron.ipcMain.once("renderer_started", () => {
		win.webContents.send("renderer_globals", {
			user_data_path: electron.app.getPath("userData")
		});
	});

	electron.ipcMain.once("renderer_ready", () => {

		have_received_ready = true;

		try {
			win.webContents.setZoomFactor(desired_zoomfactor);	// This seems to work, note issue 10572 above.
		} catch (err) {
			win.webContents.zoomFactor = desired_zoomfactor;	// The method above "will be removed" in future.
		}
		if (config.maxed) {
			win.maximize();
		}
		win.show();
		win.focus();

		queued_files_spinner();

		// console.log (in renderer) the status of hardware acceleration...

		let hw_msg = "";

		if (config.enable_hw_accel) {
			hw_msg = "Hardware acceleration is enabled. On some systems this may degrade KataGo performance.";
		} else {
			if (actually_disabled_hw_accel) {
				hw_msg = "Hardware acceleration is disabled.";
			} else {
				hw_msg = "Failed to disable hardware acceleration.";
			}
		}

		win.webContents.send("call", {
			fn: "log",
			args: [hw_msg],
		});
	});

	if (path.basename(process.argv[0]) === "electron.exe") {	// i.e. it's not in production but in dev...
		setTimeout(() => {
			if (!have_received_ready) {							// We never received renderer_ready, so probably a syntax error in renderer source.
				win.show();
				win.focus();
			}
		}, 1000);
	}

	electron.ipcMain.on("alert", (event, msg) => {
		alert(win, msg);
	});

	electron.ipcMain.on("set_title", (event, msg) => {
		win.setTitle(msg);
	});

	electron.ipcMain.on("set_checks", (event, msg) => {
		set_checks(msg);
	});

	electron.ipcMain.on("set_check_false", (event, msg) => {
		set_one_check(false, msg);
	});

	electron.ipcMain.on("set_check_true", (event, msg) => {
		set_one_check(true, msg);
	});

	electron.ipcMain.on("fix_colour_checks", (event, msg) => {
		fix_colour_checks(msg);
	});

	electron.ipcMain.on("verify_menupath", (event, msg) => {
		verify_menupath(msg);
	});

	electron.ipcMain.on("save_as_required", (event, msg) => {
		electron.dialog.showSaveDialog(win, {
			defaultPath: config.sgf_folder,
			filters: [{name: "Smart Game Format", extensions: ["sgf"]}, {name: "All files", extensions: ["*"]}]
		})
		.then(o => {
			if (typeof o.filePath === "string" && o.filePath.length > 0) {
				win.webContents.send("call", {
					fn: "save",
					args: [o.filePath]
				});
				two_process_set("sgf_folder", path.dirname(o.filePath));
			}
		});
	});

	electron.Menu.setApplicationMenu(menu);
	menu_is_set = true;

	// Actually load the page last, I guess, so the event handlers above are already set up.

	win.loadFile(
		path.join(__dirname, "ogatak.html")
	);
});

// --------------------------------------------------------------------------------------------------------------

function menu_build() {

	// Below, almost every single menu item is slavishly laid out in full...
	//
	// It's possible to construct functions that generate menu items, or even entire lists of menu items, given
	// the necessary parameters. Some experiments with this are in the "menu_remake" branch in the repo. Doing
	// so saves space in this file but adds some complexity for (imo) no real benefit...

	const template = [

		// File menu...............................................................................

		{
			label: translate("MENU_FILE"),
			submenu: [
				{
					label: translate("MENU_ABOUT"),
					click: () => {
						win.webContents.send("call", {
							fn: "about",
							args: [electron.app.getName(), electron.app.getVersion()]
						});
					}
				},
				{
					type: "separator",
				},
				{
					label: translate("MENU_NEW_BOARD"),
					accelerator: "CommandOrControl+N",
					click: () => {
						win.webContents.send("call", {
							fn: "new_game",
							args: [19, 19]
						});
					}
				},
				{
					label: translate("MENU_NEW_SMALL_BOARD"),
					submenu: [
						{
							label: "17 x 17",
							click: () => {
								win.webContents.send("call", {
									fn: "new_game",
									args: [17, 17]
								});
							}
						},
						{
							label: "15 x 15",
							click: () => {
								win.webContents.send("call", {
									fn: "new_game",
									args: [15, 15]
								});
							}
						},
						{
							label: "13 x 13",
							click: () => {
								win.webContents.send("call", {
									fn: "new_game",
									args: [13, 13]
								});
							}
						},
						{
							label: "11 x 11",
							click: () => {
								win.webContents.send("call", {
									fn: "new_game",
									args: [11, 11]
								});
							}
						},
						{
							label: "9 x 9",
							click: () => {
								win.webContents.send("call", {
									fn: "new_game",
									args: [9, 9]
								});
							}
						},
						{
							label: "7 x 7",
							click: () => {
								win.webContents.send("call", {
									fn: "new_game",
									args: [7, 7]
								});
							}
						},
					]
				},
				{
					label: translate("MENU_NEW_RECTANGULAR_BOARD"),
					submenu: rectangular_submenu(),
				},
				{
					type: "separator",
				},
				{
					label: translate("MENU_HANDICAP"),
					submenu: [
						{
							label: "9",
							click: () => {
								win.webContents.send("call", {
									fn: "place_handicap",
									args: [9]
								});
							}
						},
						{
							label: "8",
							click: () => {
								win.webContents.send("call", {
									fn: "place_handicap",
									args: [8]
								});
							}
						},
						{
							label: "7",
							click: () => {
								win.webContents.send("call", {
									fn: "place_handicap",
									args: [7]
								});
							}
						},
						{
							label: "6",
							click: () => {
								win.webContents.send("call", {
									fn: "place_handicap",
									args: [6]
								});
							}
						},
						{
							label: "5",
							click: () => {
								win.webContents.send("call", {
									fn: "place_handicap",
									args: [5]
								});
							}
						},
						{
							label: "4",
							click: () => {
								win.webContents.send("call", {
									fn: "place_handicap",
									args: [4]
								});
							}
						},
						{
							label: "3",
							click: () => {
								win.webContents.send("call", {
									fn: "place_handicap",
									args: [3]
								});
							}
						},
						{
							label: "2",
							click: () => {
								win.webContents.send("call", {
									fn: "place_handicap",
									args: [2]
								});
							}
						},
					]
				},
				{
					type: "separator",
				},
				{
					label: translate("MENU_CLOSE_TAB"),
					accelerator: "CommandOrControl+W",
					click: () => {
						win.webContents.send("call", "close_tab");
					}
				},
				{
					type: "separator",
				},
				{
					label: translate("MENU_OPEN"),
					accelerator: "CommandOrControl+O",
					click: () => {
						electron.dialog.showOpenDialog(win, {
							defaultPath: config.sgf_folder,
							properties: [
								"openFile",				// Note: "openFile" seems needed for Mac when also using "multiSelections" - Electron #6472
								"multiSelections"
							],
							filters: [
								{name: "Kifu", extensions: ["sgf", "gib", "ngf", "ugi", "ugf"]},
								{name: "All files", extensions: ["*"]}
							]
						}).then(o => {
							if (Array.isArray(o.filePaths) && o.filePaths.length > 0) {
								win.webContents.send("call", {
									fn: "load_multifile",
									args: [o.filePaths]
								});
								two_process_set("sgf_folder", path.dirname(o.filePaths[0]));
							}
						});
					}
				},
				{
					label: translate("MENU_PASTE_SGF"),
					accelerator: "CommandOrControl+Shift+V",
					click: () => {
						win.webContents.send("call", {
							fn: "load_sgf_from_string",
							args: [electron.clipboard.readText()]
						});
					}
				},
				{
					type: "separator",
				},
				{
					label: translate("MENU_SAVE_GAME"),
					accelerator: "CommandOrControl+S",
					click: () => {
						win.webContents.send("call", "save_fast");
					}
				},
				{
					label: translate("MENU_SAVE_GAME_AS"),
					click: () => {
						electron.dialog.showSaveDialog(win, {
							defaultPath: config.sgf_folder,
							filters: [{name: "Smart Game Format", extensions: ["sgf"]}, {name: "All files", extensions: ["*"]}]
						})
						.then(o => {
							if (typeof o.filePath === "string" && o.filePath.length > 0) {
								win.webContents.send("call", {
									fn: "save",
									args: [o.filePath]
								});
								two_process_set("sgf_folder", path.dirname(o.filePath));
							}
						});
					},
				},
				{
					type: "separator",
				},
				{
					label: translate("MENU_SAVE_COLLECTION_AS"),
					click: () => {
						electron.dialog.showSaveDialog(win, {
							defaultPath: config.sgf_folder,
							filters: [{name: "Smart Game Format", extensions: ["sgf"]}, {name: "All files", extensions: ["*"]}]
						})
						.then(o => {
							if (typeof o.filePath === "string" && o.filePath.length > 0) {
								win.webContents.send("call", {
									fn: "save_collection",
									args: [o.filePath]
								});
								two_process_set("sgf_folder", path.dirname(o.filePath));
							}
						});
					},
				},
				{
					type: "separator",
				},
				{
					label: translate("MENU_QUIT"),
					accelerator: "CommandOrControl+Q",
					role: "quit"
				},
			]
		},

		// Setup menu..............................................................................

		{
			label: translate("MENU_SETUP"),
			submenu: [
				{
					label: translate("MENU_LOCATE_KATAGO"),
					click: () => {
						electron.dialog.showOpenDialog(win, {defaultPath: config.katago_folder})
						.then(o => {
							if (Array.isArray(o.filePaths) && o.filePaths.length > 0) {
								win.webContents.send("set", {engine: o.filePaths[0]});
								two_process_set("katago_folder", path.dirname(o.filePaths[0]));
							}
						});
					},
				},
				{
					label: translate("MENU_LOCATE_KATAGO_ANALYSIS_CONFIG"),
					click: () => {
						electron.dialog.showOpenDialog(win, {defaultPath: config.kataconfig_folder})
						.then(o => {
							if (Array.isArray(o.filePaths) && o.filePaths.length > 0) {
								win.webContents.send("set", {engineconfig: o.filePaths[0]});
								two_process_set("kataconfig_folder", path.dirname(o.filePaths[0]));
							}
						});
					},
				},
				{
					label: translate("MENU_CHOOSE_WEIGHTS"),
					click: () => {
						electron.dialog.showOpenDialog(win, {defaultPath: config.weights_folder})
						.then(o => {
							if (Array.isArray(o.filePaths) && o.filePaths.length > 0) {
								win.webContents.send("set", {weights: o.filePaths[0]});
								two_process_set("weights_folder", path.dirname(o.filePaths[0]));
							}
						});
					},
				},
				{
					type: "separator",
				},
				{
					label: translate("MENU_CLEAR_CACHE"),
					click: () => {
						win.webContents.send("call", "clear_cache");
					}
				},
				{
					label: translate("MENU_RESTART"),
					click: () => {
						win.webContents.send("call", "start_engine");
					}
				},
				{
					type: "separator",
				},
				{
					label: translate("MENU_ENGINE_REPORT_RATE"),
					submenu: [
						{
							label: "0.1",
							type: "checkbox",
							checked: config.report_every === 0.1,
							click: () => {
								win.webContents.send("set", {report_every: 0.1});
							}
						},
						{
							label: "0.15",
							type: "checkbox",
							checked: config.report_every === 0.15,
							click: () => {
								win.webContents.send("set", {report_every: 0.15});
							}
						},
						{
							label: "0.2",
							type: "checkbox",
							checked: config.report_every === 0.2,
							click: () => {
								win.webContents.send("set", {report_every: 0.2});
							}
						},
						{
							label: "0.3",
							type: "checkbox",
							checked: config.report_every === 0.3,
							click: () => {
								win.webContents.send("set", {report_every: 0.3});
							}
						},
						{
							label: "0.4",
							type: "checkbox",
							checked: config.report_every === 0.4,
							click: () => {
								win.webContents.send("set", {report_every: 0.4});
							}
						},
					]
				},
				{
					label: translate("MENU_FAST_FIRST_REPORT"),
					type: "checkbox",
					checked: config.fast_first_report,
					click: () => {
						win.webContents.send("toggle", "fast_first_report");
					}
				},
			]
		},

		// Tree menu...............................................................................

		{
			label: translate("MENU_TREE"),
			submenu: [
				{
					label: translate("MENU_PLAY_BEST_MOVE"),
					accelerator: ",",			// See notes on "Space" accelerator shenanigans, below.
					click: () => {
						let time_since_comma = new Date() - comma_time;
						if (time_since_comma > 200) {
							win.webContents.send("call", "play_best");
						}
					}
				},
				{
					label: translate("MENU_PASS"),
					accelerator: "CommandOrControl+P",
					click: () => {
						win.webContents.send("call", "pass");
					}
				},
				{
					type: "separator",
				},
				{
					label: translate("MENU_ROOT"),
					accelerator: "Home",		// Likely intercepted by the renderer process, see __start_handlers.js
					click: () => {
						win.webContents.send("call", "go_to_root");
					}
				},
				{
					label: translate("MENU_END"),
					accelerator: "End",			// Likely intercepted by the renderer process, see __start_handlers.js
					click: () => {
						win.webContents.send("call", "go_to_end");
					}
				},
				{
					type: "separator",
				},
				{
					label: translate("MENU_BACKWARD"),
					accelerator: "Up",			// Likely intercepted by the renderer process, see __start_handlers.js
					click: () => {
						win.webContents.send("call", {
							fn: "input_up_down",
							args: [-1]
						});
					}
				},
				{
					label: translate("MENU_FORWARD"),
					accelerator: "Down",		// Likely intercepted by the renderer process, see __start_handlers.js
					click: () => {
						win.webContents.send("call", {
							fn: "input_up_down",
							args: [1]
						});
					}
				},
				{
					type: "separator",
				},
				{
					label: translate("MENU_BACKWARD_10"),
					accelerator: "PageUp",		// Likely intercepted by the renderer process, see __start_handlers.js
					click: () => {
						win.webContents.send("call", {
							fn: "input_up_down",
							args: [-10]
						});
					}
				},
				{
					label: translate("MENU_FORWARD_10"),
					accelerator: "PageDown",	// Likely intercepted by the renderer process, see __start_handlers.js
					click: () => {
						win.webContents.send("call", {
							fn: "input_up_down",
							args: [10]
						});
					}
				},
				{
					type: "separator",
				},
				{
					label: translate("MENU_PREVIOUS_SIBLING"),
					accelerator: "Left",
					click: () => {
						win.webContents.send("call", "prev_sibling");
					}
				},
				{
					label: translate("MENU_NEXT_SIBLING"),
					accelerator: "Right",
					click: () => {
						win.webContents.send("call", "next_sibling");
					}
				},
				{
					type: "separator",
				},
				{
					label: translate("MENU_RETURN_TO_MAIN_LINE"),
					accelerator: "CommandOrControl+R",
					click: () => {
						win.webContents.send("call", "return_to_main");
					}
				},
				{
					type: "separator",
				},
				{
					label: translate("MENU_FIND_PREVIOUS_FORK"),
					accelerator: "CommandOrControl+D",
					click: () => {
						win.webContents.send("call", "previous_fork");
					}
				},
				{
					label: translate("MENU_FIND_NEXT_FORK"),
					accelerator: "CommandOrControl+F",
					click: () => {
						win.webContents.send("call", "next_fork");
					}
				},
				{
					type: "separator",
				},
				{
					label: translate("MENU_PROMOTE_LINE"),
					accelerator: "CommandOrControl+K",
					click: () => {
						win.webContents.send("call", {
							fn: "promote",
							args: [false]
						});
					}
				},
				{
					label: translate("MENU_PROMOTE_LINE_TO_MAIN_LINE"),
					accelerator: "CommandOrControl+L",
					click: () => {
						win.webContents.send("call", {
							fn: "promote_to_main_line",
							args: [false]
						});
					}
				},
				{
					type: "separator",
				},
				{
					label: translate("MENU_DELETE_NODE"),
					accelerator: "CommandOrControl+Backspace",
					click: () => {
						win.webContents.send("call", "delete_node");
					}
				},
				{
					label: translate("MENU_DELETE_ALL_PREVIOUS_FORKS"),
					click: () => {
						win.webContents.send("call", {
							fn: "delete_other_lines",
							args: [false],
						});
					}
				},
			]
		},

		// Tools menu..............................................................................

		{
			label: translate("MENU_TOOLS"),								// Needs special treatment in hub_settings.js, because its values don't match its labels.
			submenu: [
				{
					label: translate("MENU_NORMAL"),
					type: "checkbox",
					checked: !config.editing,
					accelerator: "CommandOrControl+1",
					click: () => {
						win.webContents.send("set", {editing: ""});
					}
				},
				{
					type: "separator",
				},
				{
					label: translate("MENU_ADD_BLACK"),
					type: "checkbox",
					checked: config.editing === "AB",
					accelerator: "CommandOrControl+2",
					click: () => {
						win.webContents.send("set", {editing: "AB"});
					}
				},
				{
					label: translate("MENU_ADD_WHITE"),
					type: "checkbox",
					checked: config.editing === "AW",
					accelerator: "CommandOrControl+3",
					click: () => {
						win.webContents.send("set", {editing: "AW"});
					}
				},
				{
					label: translate("MENU_ADD_EMPTY"),
					type: "checkbox",
					checked: config.editing === "AE",
					accelerator: "CommandOrControl+4",
					click: () => {
						win.webContents.send("set", {editing: "AE"});
					}
				},
				{
					type: "separator",
				},
				{
					label: translate("MENU_TRIANGLE"),
					type: "checkbox",
					checked: config.editing === "TR",
					accelerator: "CommandOrControl+5",
					click: () => {
						win.webContents.send("set", {editing: "TR"});
					}
				},
				{
					label: translate("MENU_SQUARE"),
					type: "checkbox",
					checked: config.editing === "SQ",
					accelerator: "CommandOrControl+6",
					click: () => {
						win.webContents.send("set", {editing: "SQ"});
					}
				},
				{
					label: translate("MENU_CIRCLE"),
					type: "checkbox",
					checked: config.editing === "CR",
					accelerator: "CommandOrControl+7",
					click: () => {
						win.webContents.send("set", {editing: "CR"});
					}
				},
				{
					label: translate("MENU_CROSS"),
					type: "checkbox",
					checked: config.editing === "MA",
					accelerator: "CommandOrControl+8",
					click: () => {
						win.webContents.send("set", {editing: "MA"});
					}
				},
				{
					type: "separator",
				},
				{
					label: translate("MENU_LABELS_ABC"),
					type: "checkbox",
					checked: config.editing === "LB:A",
					accelerator: "CommandOrControl+9",
					click: () => {
						win.webContents.send("set", {editing: "LB:A"});
					}
				},
				{
					label: translate("MENU_LABELS_123"),
					type: "checkbox",
					checked: config.editing === "LB:1",
					accelerator: "CommandOrControl+0",
					click: () => {
						win.webContents.send("set", {editing: "LB:1"});
					}
				},
				{
					type: "separator",
				},
				{
					label: translate("MENU_TOGGLE_ACTIVE_PLAYER"),
					click: () => {
						win.webContents.send("call", "toggle_active_player");
					}
				},
				{
					type: "separator",
				},
				{
					label: translate("MENU_GAME_INFO_EDITOR"),
					accelerator: "CommandOrControl+I",
					click: () => {
						win.webContents.send("call", "display_root_editor");
					}
				},
			]
		},

		// Analysis menu...........................................................................

		{
			label: translate("MENU_ANALYSIS"),
			submenu: [
				{
					label: translate("MENU_GO_HALT_TOGGLE"),	// We do some shenanigans here to show "Space" to the user as a valid accelerator, while
					accelerator: "Space",						// actually ignoring it - spacebar is handled entirely on the renderer side, because of
																// reasons. Thus, somewhere above we declared a handler for "before-input-event" events
																// which we use to track when the last spacebar press happened, BEFORE this sees it.
					click: () => {
						let time_since_spacebar = new Date() - spacebar_time;
						if (time_since_spacebar > 200) {								// When user *clicks* the menu item rather than pressing space.
							win.webContents.send("call", "toggle_ponder");
						}
					}
				},
				{
					type: "separator",
				},
				{
					label: translate("MENU_GO"),
					accelerator: "CommandOrControl+G",
					click: () => {
						win.webContents.send("call", "go");
					}
				},
				{
					label: translate("MENU_HALT"),
					accelerator: "CommandOrControl+H",
					click: () => {
						win.webContents.send("call", "halt_by_user");
					}
				},
				{
					type: "separator",
				},
				{
					label: translate("MENU_SELF_PLAY"),
					type: "checkbox",
					checked: false,
					accelerator: "F11",
					click: () => {
						win.webContents.send("call", "toggle_selfplay");
					}
				},
				{
					label: translate("MENU_AUTOANALYSIS"),
					accelerator: "F12",
					type: "checkbox",
					checked: false,
					click: () => {
						win.webContents.send("call", "toggle_autoanalysis");
					}
				},
				{
					label: translate("MENU_BACKWARD_ANALYSIS"),
					type: "checkbox",
					checked: false,
					click: () => {
						win.webContents.send("call", "toggle_backanalysis");
					}
				},
				{
					type: "separator",
				},
				{
					label: translate("MENU_AUTOANALYSIS_VISITS"),
					submenu: visit_submenu(),
				},
				{
					type: "separator",
				},
				{
					label: translate("MENU_SET_RULES"),
					submenu: [
						{
							label: translate("MENU_CHINESE"),
							click: () => {
								win.webContents.send("call", {
									fn: "coerce_rules",
									args: ["Chinese"]
								});
							}
						},
						{
							label: translate("MENU_JAPANESE"),
							click: () => {
								win.webContents.send("call", {
									fn: "coerce_rules",
									args: ["Japanese"]
								});
							}
						},
						{
							label: translate("MENU_STONE_SCORING"),
							click: () => {
								win.webContents.send("call", {
									fn: "coerce_rules",
									args: ["Stone Scoring"]
								});
							}
						},
					]
				},
				{
					label: translate("MENU_SET_KOMI"),
					submenu: komi_submenu(),
				},
				{
					type: "separator",
				},
				{
					label: translate("MENU_PV_LENGTH_MAX"),
					submenu: [
						{
							label: "30",
							type: "checkbox",
							checked: config.analysis_pv_len === 30,
							click: () => {
								win.webContents.send("set", {analysis_pv_len: 30});
							}
						},
						{
							label: "28",
							type: "checkbox",
							checked: config.analysis_pv_len === 28,
							click: () => {
								win.webContents.send("set", {analysis_pv_len: 28});
							}
						},
						{
							label: "26",
							type: "checkbox",
							checked: config.analysis_pv_len === 26,
							click: () => {
								win.webContents.send("set", {analysis_pv_len: 26});
							}
						},
						{
							label: "24",
							type: "checkbox",
							checked: config.analysis_pv_len === 24,
							click: () => {
								win.webContents.send("set", {analysis_pv_len: 24});
							}
						},
						{
							label: "22",
							type: "checkbox",
							checked: config.analysis_pv_len === 22,
							click: () => {
								win.webContents.send("set", {analysis_pv_len: 22});
							}
						},
						{
							label: "20",
							type: "checkbox",
							checked: config.analysis_pv_len === 20,
							click: () => {
								win.webContents.send("set", {analysis_pv_len: 20});
							}
						},
						{
							label: "18",
							type: "checkbox",
							checked: config.analysis_pv_len === 18,
							click: () => {
								win.webContents.send("set", {analysis_pv_len: 18});
							}
						},
						{
							label: "16",
							type: "checkbox",
							checked: config.analysis_pv_len === 16,
							click: () => {
								win.webContents.send("set", {analysis_pv_len: 16});
							}
						},
						{
							label: "14",
							type: "checkbox",
							checked: config.analysis_pv_len === 14,
							click: () => {
								win.webContents.send("set", {analysis_pv_len: 14});
							}
						},
						{
							label: "12",
							type: "checkbox",
							checked: config.analysis_pv_len === 12,
							click: () => {
								win.webContents.send("set", {analysis_pv_len: 12});
							}
						},
						{
							label: "10",
							type: "checkbox",
							checked: config.analysis_pv_len === 10,
							click: () => {
								win.webContents.send("set", {analysis_pv_len: 10});
							}
						},
					]
				},
				{
					label: translate("MENU_WIDE_ROOT_NOISE"),
					submenu: [
						{
							label: "0.05",
							type: "checkbox",
							checked: config.wide_root_noise === 0.05,
							click: () => {
								win.webContents.send("set", {wide_root_noise: 0.05});
							}
						},
						{
							label: "0.04",
							type: "checkbox",
							checked: config.wide_root_noise === 0.04,
							click: () => {
								win.webContents.send("set", {wide_root_noise: 0.04});
							}
						},
						{
							label: "0.03",
							type: "checkbox",
							checked: config.wide_root_noise === 0.03,
							click: () => {
								win.webContents.send("set", {wide_root_noise: 0.03});
							}
						},
						{
							label: "0.02",
							type: "checkbox",
							checked: config.wide_root_noise === 0.02,
							click: () => {
								win.webContents.send("set", {wide_root_noise: 0.02});
							}
						},
						{
							label: "0.01",
							type: "checkbox",
							checked: config.wide_root_noise === 0.01,
							click: () => {
								win.webContents.send("set", {wide_root_noise: 0.01});
							}
						},
						{
							label: "0",
							type: "checkbox",
							checked: config.wide_root_noise === 0,
							click: () => {
								win.webContents.send("set", {wide_root_noise: 0});
							}
						},
					]
				},
				{
					type: "separator",
				},
				{
					label: translate("MENU_OWNERSHIP"),
					submenu: [
						{
							label: translate("MENU_NO_OWNERSHIP"),
							type: "checkbox",
							checked: config.ownership_marks === 0,
							accelerator: "CommandOrControl+;",
							click: () => {
								win.webContents.send("set", {ownership_marks: 0});
							}
						},
						{
							label: translate("MENU_DEAD_STONES"),
							type: "checkbox",
							checked: config.ownership_marks === 1,
							accelerator: "CommandOrControl+[",
							click: () => {
								win.webContents.send("set", {ownership_marks: 1});
							}
						},
						{
							label: translate("MENU_WHOLE_BOARD"),
							type: "checkbox",
							checked: config.ownership_marks === 2,
							accelerator: "CommandOrControl+]",
							click: () => {
								win.webContents.send("set", {ownership_marks: 2});
							}
						},
						{
							label: translate("MENU_WHOLE_BOARD_ALT"),
							type: "checkbox",
							checked: config.ownership_marks === 3,
							accelerator: "CommandOrControl+Shift+]",
							click: () => {
								win.webContents.send("set", {ownership_marks: 3});
							}
						},
					]
				},
				{
					label: translate("MENU_PER_MOVE"),
					type: "checkbox",
					checked: config.ownership_per_move,
					click: () => {
						win.webContents.send("toggle", "ownership_per_move");
					}
				},
				{
					type: "separator",
				},
				{
					label: translate("MENU_PERFORMANCE_REPORT"),
					click: () => {
						win.webContents.send("call", "performance");
					}
				},
				{
					type: "separator",
				},
				{
					label: translate("MENU_CLEAR_ALL_ANALYSIS"),
					click: () => {
						win.webContents.send("call", "forget_analysis_tree");
					}
				},
			]
		},

		// Display menu............................................................................

		{
			label: translate("MENU_DISPLAY"),
			submenu: [
				{
					label: translate("MENU_VISIT_FILTER"),	// Needs special treatment in hub_settings.js, because its values don't match its labels.
					submenu: [
						{
							label: translate("MENU_ALL"),
							type: "checkbox",
							checked: config.visits_threshold === 0,
							click: () => {
								win.webContents.send("set", {visits_threshold: 0});
							}
						},
						{
							type: "separator"
						},
						{
							label: "N > 0.5%",
							type: "checkbox",
							checked: config.visits_threshold === 0.005,
							accelerator: "F1",
							click: () => {
								win.webContents.send("set", {visits_threshold: 0.005});
							}
						},
						{
							label: "N > 1%",
							type: "checkbox",
							checked: config.visits_threshold === 0.01,
							click: () => {
								win.webContents.send("set", {visits_threshold: 0.01});
							}
						},
						{
							label: "N > 2%",
							type: "checkbox",
							checked: config.visits_threshold === 0.02,
							accelerator: "F2",
							click: () => {
								win.webContents.send("set", {visits_threshold: 0.02});
							}
						},
						{
							label: "N > 4%",
							type: "checkbox",
							checked: config.visits_threshold === 0.04,
							click: () => {
								win.webContents.send("set", {visits_threshold: 0.04});
							}
						},
						{
							label: "N > 6%",
							type: "checkbox",
							checked: config.visits_threshold === 0.06,
							accelerator: "F3",
							click: () => {
								win.webContents.send("set", {visits_threshold: 0.06});
							}
						},
						{
							label: "N > 8%",
							type: "checkbox",
							checked: config.visits_threshold === 0.08,
							click: () => {
								win.webContents.send("set", {visits_threshold: 0.08});
							}
						},
						{
							label: "N > 10%",
							type: "checkbox",
							checked: config.visits_threshold === 0.1,
							accelerator: "F4",
							click: () => {
								win.webContents.send("set", {visits_threshold: 0.1});
							}
						},
					]
				},
				{
					label: translate("MENU_NUMBERS"),
					submenu: [
						{
							label: `${translate("MENU_NUM_WINRATE")} + ${translate("MENU_NUM_VISITS")}`,
							type: "checkbox",
							checked: config.numbers === "Winrate + Visits",
							accelerator: "F5",
							click: () => {
								win.webContents.send("set", {numbers: "Winrate + Visits"});
							}
						},
						{
							label: `${translate("MENU_NUM_LCB")} + ${translate("MENU_NUM_VISITS")}`,
							type: "checkbox",
							checked: config.numbers === "LCB + Visits",
							click: () => {
								win.webContents.send("set", {numbers: "LCB + Visits"});
							}
						},
						{
							type: "separator",
						},
						{
							label: `${translate("MENU_NUM_SCORE")} + ${translate("MENU_NUM_VISITS")}`,
							type: "checkbox",
							checked: config.numbers === "Score + Visits",
							accelerator: "F6",
							click: () => {
								win.webContents.send("set", {numbers: "Score + Visits"});
							}
						},
						{
							label: `${translate("MENU_NUM_DELTA")} + ${translate("MENU_NUM_VISITS")}`,
							type: "checkbox",
							checked: config.numbers === "Delta + Visits",
							accelerator: "F7",
							click: () => {
								win.webContents.send("set", {numbers: "Delta + Visits"});
							}
						},
						{
							type: "separator",
						},
						{
							label: translate("MENU_NUM_WINRATE"),
							type: "checkbox",
							checked: config.numbers === "Winrate",
							click: () => {
								win.webContents.send("set", {numbers: "Winrate"});
							}
						},
						{
							label: translate("MENU_NUM_LCB"),
							type: "checkbox",
							checked: config.numbers === "LCB",
							click: () => {
								win.webContents.send("set", {numbers: "LCB"});
							}
						},
						{
							label: translate("MENU_NUM_SCORE"),
							type: "checkbox",
							checked: config.numbers === "Score",
							click: () => {
								win.webContents.send("set", {numbers: "Score"});
							}
						},
						{
							label: translate("MENU_NUM_DELTA"),
							type: "checkbox",
							checked: config.numbers === "Delta",
							click: () => {
								win.webContents.send("set", {numbers: "Delta"});
							}
						},
						{
							label: translate("MENU_NUM_VISITS"),
							type: "checkbox",
							checked: config.numbers === "Visits",
							click: () => {
								win.webContents.send("set", {numbers: "Visits"});
							}
						},
						{
							label: translate("MENU_NUM_VISITS_PC"),
							type: "checkbox",
							checked: config.numbers === "Visits (%)",
							click: () => {
								win.webContents.send("set", {numbers: "Visits (%)"});
							}
						},
						{
							label: translate("MENU_NUM_ORDER"),
							type: "checkbox",
							checked: config.numbers === "Order",
							click: () => {
								win.webContents.send("set", {numbers: "Order"});
							}
						},
						{
							label: translate("MENU_NUM_POLICY"),
							type: "checkbox",
							checked: config.numbers === "Policy",
							click: () => {
								win.webContents.send("set", {numbers: "Policy"});
							}
						},
						{
							type: "separator",
						},
						{
							label: `${translate("MENU_NUM_WINRATE")} + ${translate("MENU_NUM_VISITS")} + ${translate("MENU_NUM_SCORE")}`,
							type: "checkbox",
							checked: config.numbers === "Winrate + Visits + Score",
							accelerator: "F8",
							click: () => {
								win.webContents.send("set", {numbers: "Winrate + Visits + Score"});
							}
						},
						{
							label: `${translate("MENU_NUM_LCB")} + ${translate("MENU_NUM_VISITS")} + ${translate("MENU_NUM_SCORE")}`,
							type: "checkbox",
							checked: config.numbers === "LCB + Visits + Score",
							click: () => {
								win.webContents.send("set", {numbers: "LCB + Visits + Score"});
							}
						},
					]
				},
				{
					label: translate("MENU_GRAPH"),
					submenu: [
						{
							label: translate("MENU_GRAPH_WINRATE"),
							type: "checkbox",
							checked: config.graph_type === 1,
							accelerator: "F9",
							click: () => {
								win.webContents.send("set", {graph_type: 1});
							}
						},
						{
							label: translate("MENU_GRAPH_SCORE"),
							type: "checkbox",
							checked: config.graph_type === 2,
							accelerator: "F10",
							click: () => {
								win.webContents.send("set", {graph_type: 2});
							}
						},
					]
				},
				{
					type: "separator",
				},
				{
					label: translate("MENU_BLACK_POV_ALWAYS"),
					type: "checkbox",
					checked: config.black_pov,
					click: () => {
						win.webContents.send("toggle", "black_pov");
					}
				},
				{
					type: "separator",
				},
				{
					label: translate("MENU_CANDIDATE_MOVES"),
					type: "checkbox",
					checked: config.candidate_moves,
					accelerator: "CommandOrControl+M",
					click: () => {
						win.webContents.send("toggle", "candidate_moves");
					}
				},
				{
					label: translate("MENU_NO_PONDER_NO_CANDIDATES"),
					type: "checkbox",
					checked: config.no_ponder_no_candidates,
					click: () => {
						win.webContents.send("toggle", "no_ponder_no_candidates");
					}
				},
				{
					label: translate("MENU_WITH_PV_MOUSEOVER"),
					type: "checkbox",
					checked: config.mouseover_pv,
					accelerator: "CommandOrControl+Shift+M",
					click: () => {
						win.webContents.send("toggle", "mouseover_pv");
					}
				},
				{
					label: translate("MENU_FADE_BY_VISITS"),
					type: "checkbox",
					checked: config.visit_colours,
					click: () => {
						win.webContents.send("toggle", "visit_colours");
					}
				},
				{
					label: translate("MENU_MOUSEOVER_DELAY"),
					submenu: [
						{
							label: "0.8",
							type: "checkbox",
							checked: config.mouseover_delay === 0.8,
							click: () => {
								win.webContents.send("set", {mouseover_delay: 0.8});
							}
						},
						{
							label: "0.6",
							type: "checkbox",
							checked: config.mouseover_delay === 0.6,
							click: () => {
								win.webContents.send("set", {mouseover_delay: 0.6});
							}
						},
						{
							label: "0.4",
							type: "checkbox",
							checked: config.mouseover_delay === 0.4,
							click: () => {
								win.webContents.send("set", {mouseover_delay: 0.4});
							}
						},
						{
							label: "0.2",
							type: "checkbox",
							checked: config.mouseover_delay === 0.2,
							click: () => {
								win.webContents.send("set", {mouseover_delay: 0.2});
							}
						},
						{
							label: "0",
							type: "checkbox",
							checked: config.mouseover_delay === 0,
							click: () => {
								win.webContents.send("set", {mouseover_delay: 0});
							}
						},
					]
				},
				{
					type: "separator",
				},
				{
					label: translate("MENU_NEXT_MOVE_MARKERS"),
					type: "checkbox",
					checked: config.next_move_markers,
					click: () => {
						win.webContents.send("toggle", "next_move_markers");
					}
				},
				{
					type: "separator",
				},
				{
					label: translate("MENU_COORDINATES"),
					type: "checkbox",
					checked: config.coordinates,
					click: () => {
						win.webContents.send("toggle", "coordinates");
					}
				},
				{
					label: translate("MENU_STONE_COUNTS"),
					type: "checkbox",
					checked: config.stone_counts,
					click: () => {
						win.webContents.send("toggle", "stone_counts");
					}
				},
				{
					type: "separator",
				},
				{
					label: translate("MENU_COLOURS"),
					submenu: colour_choices_submenu(),
				},
			]
		},

		// Sizes menu..............................................................................

		{
			label: translate("MENU_SIZES"),
			submenu: [
				{
					label: translate("MENU_EMBIGGEN_SMALL_BOARDS"),
					type: "checkbox",
					checked: config.embiggen_small_boards,
					click: () => {
						win.webContents.send("toggle", "embiggen_small_boards");
					}
				},
				{
					type: "separator"
				},
				{
					label: translate("MENU_INFO_FONT"),
					submenu: [
						{
							label: "32",
							type: "checkbox",
							checked: config.info_font_size === 32,
							click: () => {
								win.webContents.send("set", {info_font_size: 32});
							}
						},
						{
							label: "30",
							type: "checkbox",
							checked: config.info_font_size === 30,
							click: () => {
								win.webContents.send("set", {info_font_size: 30});
							}
						},
						{
							label: "28",
							type: "checkbox",
							checked: config.info_font_size === 28,
							click: () => {
								win.webContents.send("set", {info_font_size: 28});
							}
						},
						{
							label: "26",
							type: "checkbox",
							checked: config.info_font_size === 26,
							click: () => {
								win.webContents.send("set", {info_font_size: 26});
							}
						},
						{
							label: "24",
							type: "checkbox",
							checked: config.info_font_size === 24,
							click: () => {
								win.webContents.send("set", {info_font_size: 24});
							}
						},
						{
							label: "22",
							type: "checkbox",
							checked: config.info_font_size === 22,
							click: () => {
								win.webContents.send("set", {info_font_size: 22});
							}
						},
						{
							label: "20",
							type: "checkbox",
							checked: config.info_font_size === 20,
							click: () => {
								win.webContents.send("set", {info_font_size: 20});
							}
						},
						{
							label: "18",
							type: "checkbox",
							checked: config.info_font_size === 18,
							click: () => {
								win.webContents.send("set", {info_font_size: 18});
							}
						},
						{
							label: "16",
							type: "checkbox",
							checked: config.info_font_size === 16,
							click: () => {
								win.webContents.send("set", {info_font_size: 16});
							}
						},
						{
							label: "14",
							type: "checkbox",
							checked: config.info_font_size === 14,
							click: () => {
								win.webContents.send("set", {info_font_size: 14});
							}
						},
						{
							label: "12",
							type: "checkbox",
							checked: config.info_font_size === 12,
							click: () => {
								win.webContents.send("set", {info_font_size: 12});
							}
						},
					]
				},
				{
					type: "separator"
				},
				{
					label: translate("MENU_GRAPH_WIDTH"),
					submenu: [
						{
							label: "512",
							type: "checkbox",
							checked: config.graph_width === 512,
							click: () => {
								win.webContents.send("set", {graph_width: 512});
							}
						},
						{
							label: "480",
							type: "checkbox",
							checked: config.graph_width === 480,
							click: () => {
								win.webContents.send("set", {graph_width: 480});
							}
						},
						{
							label: "448",
							type: "checkbox",
							checked: config.graph_width === 448,
							click: () => {
								win.webContents.send("set", {graph_width: 448});
							}
						},
						{
							label: "416",
							type: "checkbox",
							checked: config.graph_width === 416,
							click: () => {
								win.webContents.send("set", {graph_width: 416});
							}
						},
						{
							label: "384",
							type: "checkbox",
							checked: config.graph_width === 384,
							click: () => {
								win.webContents.send("set", {graph_width: 384});
							}
						},
						{
							label: "352",
							type: "checkbox",
							checked: config.graph_width === 352,
							click: () => {
								win.webContents.send("set", {graph_width: 352});
							}
						},
						{
							label: "320",
							type: "checkbox",
							checked: config.graph_width === 320,
							click: () => {
								win.webContents.send("set", {graph_width: 320});
							}
						},
						{
							label: "288",
							type: "checkbox",
							checked: config.graph_width === 288,
							click: () => {
								win.webContents.send("set", {graph_width: 288});
							}
						},
						{
							label: "256",
							type: "checkbox",
							checked: config.graph_width === 256,
							click: () => {
								win.webContents.send("set", {graph_width: 256});
							}
						},
						{
							label: "224",
							type: "checkbox",
							checked: config.graph_width === 224,
							click: () => {
								win.webContents.send("set", {graph_width: 224});
							}
						},
						{
							label: "192",
							type: "checkbox",
							checked: config.graph_width === 192,
							click: () => {
								win.webContents.send("set", {graph_width: 192});
							}
						},
						{
							label: "160",
							type: "checkbox",
							checked: config.graph_width === 160,
							click: () => {
								win.webContents.send("set", {graph_width: 160});
							}
						},
						{
							label: "128",
							type: "checkbox",
							checked: config.graph_width === 128,
							click: () => {
								win.webContents.send("set", {graph_width: 128});
							}
						},
						{
							label: "96",
							type: "checkbox",
							checked: config.graph_width === 96,
							click: () => {
								win.webContents.send("set", {graph_width: 96});
							}
						},
						{
							label: "64",
							type: "checkbox",
							checked: config.graph_width === 64,
							click: () => {
								win.webContents.send("set", {graph_width: 64});
							}
						},
						{
							label: "0",
							type: "checkbox",
							checked: config.graph_width === 0,
							click: () => {
								win.webContents.send("set", {graph_width: 0});
							}
						}
					]
				},
				{
					label: translate("MENU_GRAPH_MAJOR_LINES"),
					submenu: [
						{
							label: "4",
							type: "checkbox",
							checked: config.major_graph_linewidth === 4,
							click: () => {
								win.webContents.send("set", {major_graph_linewidth: 4});
							}
						},
						{
							label: "3",
							type: "checkbox",
							checked: config.major_graph_linewidth === 3,
							click: () => {
								win.webContents.send("set", {major_graph_linewidth: 3});
							}
						},
						{
							label: "2",
							type: "checkbox",
							checked: config.major_graph_linewidth === 2,
							click: () => {
								win.webContents.send("set", {major_graph_linewidth: 2});
							}
						},
						{
							label: "1",
							type: "checkbox",
							checked: config.major_graph_linewidth === 1,
							click: () => {
								win.webContents.send("set", {major_graph_linewidth: 1});
							}
						},
					]
				},
				{
					label: translate("MENU_GRAPH_MINOR_LINES"),
					submenu: [
						{
							label: "4",
							type: "checkbox",
							checked: config.minor_graph_linewidth === 4,
							click: () => {
								win.webContents.send("set", {minor_graph_linewidth: 4});
							}
						},
						{
							label: "3",
							type: "checkbox",
							checked: config.minor_graph_linewidth === 3,
							click: () => {
								win.webContents.send("set", {minor_graph_linewidth: 3});
							}
						},
						{
							label: "2",
							type: "checkbox",
							checked: config.minor_graph_linewidth === 2,
							click: () => {
								win.webContents.send("set", {minor_graph_linewidth: 2});
							}
						},
						{
							label: "1",
							type: "checkbox",
							checked: config.minor_graph_linewidth === 1,
							click: () => {
								win.webContents.send("set", {minor_graph_linewidth: 1});
							}
						},
						{
							label: "0",
							type: "checkbox",
							checked: config.minor_graph_linewidth === 0,
							click: () => {
								win.webContents.send("set", {minor_graph_linewidth: 0});
							}
						},
					]
				},
				{
					type: "separator"
				},
				{
					label: translate("MENU_BOARD_LINES"),
					submenu: [
						{
							label: "4",
							type: "checkbox",
							checked: config.board_line_width === 4,
							click: () => {
								win.webContents.send("set", {board_line_width: 4});
							}
						},
						{
							label: "3",
							type: "checkbox",
							checked: config.board_line_width === 3,
							click: () => {
								win.webContents.send("set", {board_line_width: 3});
							}
						},
						{
							label: "2",
							type: "checkbox",
							checked: config.board_line_width === 2,
							click: () => {
								win.webContents.send("set", {board_line_width: 2});
							}
						},
						{
							label: "1",
							type: "checkbox",
							checked: config.board_line_width === 1,
							click: () => {
								win.webContents.send("set", {board_line_width: 1});
							}
						},
					]
				},
				{
					label: translate("MENU_THUMBNAIL_SQUARES"),
					submenu: [
						{
							label: "8",
							type: "checkbox",
							checked: config.thumbnail_square_size === 8,
							click: () => {
								win.webContents.send("set", {thumbnail_square_size: 8});
							}
						},
						{
							label: "6",
							type: "checkbox",
							checked: config.thumbnail_square_size === 6,
							click: () => {
								win.webContents.send("set", {thumbnail_square_size: 6});
							}
						},
						{
							label: "4",
							type: "checkbox",
							checked: config.thumbnail_square_size === 4,
							click: () => {
								win.webContents.send("set", {thumbnail_square_size: 4});
							}
						},
					]
				},
				{
					label: translate("MENU_TREE_SPACING"),
					submenu: [
						{
							label: "48",
							type: "checkbox",
							checked: config.tree_spacing === 48,
							click: () => {
								win.webContents.send("set", {tree_spacing: 48});
							}
						},
						{
							label: "44",
							type: "checkbox",
							checked: config.tree_spacing === 44,
							click: () => {
								win.webContents.send("set", {tree_spacing: 44});
							}
						},
						{
							label: "40",
							type: "checkbox",
							checked: config.tree_spacing === 40,
							click: () => {
								win.webContents.send("set", {tree_spacing: 40});
							}
						},
						{
							label: "36",
							type: "checkbox",
							checked: config.tree_spacing === 36,
							click: () => {
								win.webContents.send("set", {tree_spacing: 36});
							}
						},
						{
							label: "32",
							type: "checkbox",
							checked: config.tree_spacing === 32,
							click: () => {
								win.webContents.send("set", {tree_spacing: 32});
							}
						},
						{
							label: "28",
							type: "checkbox",
							checked: config.tree_spacing === 28,
							click: () => {
								win.webContents.send("set", {tree_spacing: 28});
							}
						},
						{
							label: "24",
							type: "checkbox",
							checked: config.tree_spacing === 24,
							click: () => {
								win.webContents.send("set", {tree_spacing: 24});
							}
						},
					]
				},
				{
					type: "separator"
				},
				{
					label: translate("MENU_COMMENT_BOX"),
					submenu: [
						{
							label: "512",
							type: "checkbox",
							checked: config.comment_box_height === 512,
							click: () => {
								win.webContents.send("set", {comment_box_height: 512});
							}
						},
						{
							label: "384",
							type: "checkbox",
							checked: config.comment_box_height === 384,
							click: () => {
								win.webContents.send("set", {comment_box_height: 384});
							}
						},
						{
							label: "256",
							type: "checkbox",
							checked: config.comment_box_height === 256,
							click: () => {
								win.webContents.send("set", {comment_box_height: 256});
							}
						},
						{
							label: "128",
							type: "checkbox",
							checked: config.comment_box_height === 128,
							click: () => {
								win.webContents.send("set", {comment_box_height: 128});
							}
						},
						{
							label: "0",
							type: "checkbox",
							checked: config.comment_box_height === 0,
							click: () => {
								win.webContents.send("set", {comment_box_height: 0});
							}
						},
					]
				},
			]
		},

		// Misc menu...............................................................................

		{
			label: translate("MENU_MISC"),
			submenu: [
				{
					label: translate("MENU_ESCAPE"),
					accelerator: "Escape",
					click: () => {
						win.webContents.send("call", "escape");
					}
				},
				{
					type: "separator",
				},
				{
					label: translate("MENU_ENGINE_PLAYS_BLACK"),
					type: "checkbox",
					checked: false,
					click: () => {
						win.webContents.send("call", {
							fn: "start_play_colour",
							args: ["b"]
						});
					}
				},
				{
					label: translate("MENU_ENGINE_PLAYS_WHITE"),
					type: "checkbox",
					checked: false,
					click: () => {
						win.webContents.send("call", {
							fn: "start_play_colour",
							args: ["w"]
						});
					}
				},
				{
					label: translate("MENU_ENGINE_PLAYS_CURRENT"),
					accelerator: "CommandOrControl+E",
					click: () => {
						win.webContents.send("call", {
							fn: "start_play_colour",
							args: []
						});
					}
				},
				{
					label: translate("MENU_HALT"),
					click: () => {
						win.webContents.send("call", "halt_by_user");
					}
				},
				{
					type: "separator",
				},
				{
					label: translate("MENU_ENGINE_PLAYS_POLICY"),
					type: "checkbox",
					checked: config.play_against_policy,
					click: () => {
						win.webContents.send("toggle", "play_against_policy");
					}
				},
				{
					label: translate("MENU_ENGINE_PLAYS_DRUNK"),
					type: "checkbox",
					checked: config.play_against_drunk,
					click: () => {
						win.webContents.send("toggle", "play_against_drunk");
					}
				},
				{
					type: "separator",
				},
				{
					label: translate("MENU_AUTOSCROLL"),
					type: "checkbox",
					checked: false,
					click: () => {
						win.webContents.send("call", "toggle_autoscroll");
					}
				},
				{
					label: translate("MENU_AUTOSCROLL_DELAY"),
					submenu: [
						{
							label: "5",
							type: "checkbox",
							checked: config.autoscroll_delay === 5,
							click: () => {
								win.webContents.send("set", {autoscroll_delay: 5});
							}
						},
						{
							label: "4",
							type: "checkbox",
							checked: config.autoscroll_delay === 4,
							click: () => {
								win.webContents.send("set", {autoscroll_delay: 4});
							}
						},
						{
							label: "3",
							type: "checkbox",
							checked: config.autoscroll_delay === 3,
							click: () => {
								win.webContents.send("set", {autoscroll_delay: 3});
							}
						},
						{
							label: "2",
							type: "checkbox",
							checked: config.autoscroll_delay === 2,
							click: () => {
								win.webContents.send("set", {autoscroll_delay: 2});
							}
						},
						{
							label: "1",
							type: "checkbox",
							checked: config.autoscroll_delay === 1,
							click: () => {
								win.webContents.send("set", {autoscroll_delay: 1});
							}
						},
						{
							label: "0.5",
							type: "checkbox",
							checked: config.autoscroll_delay === 0.5,
							click: () => {
								win.webContents.send("set", {autoscroll_delay: 0.5});
							}
						},
					]
				},
				{
					type: "separator",
				},
				{
					label: translate("MENU_LOAD_GAMES_AT_FINAL_POSITION"),
					type: "checkbox",
					checked: config.load_at_end,
					click: () => {
						win.webContents.send("toggle", "load_at_end");
					}
				},
				{
					label: translate("MENU_GUESS_RULES_FROM_KOMI_ON_LOAD"),
					type: "checkbox",
					checked: config.guess_ruleset,
					click: () => {
						win.webContents.send("toggle", "guess_ruleset");
					}
				},
				{
					label: translate("MENU_PREFER_TYGEM_HANDICAP_3_LAYOUT"),
					type: "checkbox",
					checked: config.tygem_3,
					click: () => {
						win.webContents.send("toggle", "tygem_3");
					}
				},
				{
					type: "separator",
				},
				{
					label: translate("MENU_ENABLE_HARDWARE_ACCELERATION_FOR_GUI"),
					type: "checkbox",
					checked: config.enable_hw_accel,
					click: () => {
						win.webContents.send("toggle", "enable_hw_accel");
					}
				},
			]
		},

		// Dev menu................................................................................

		{
			label: translate("MENU_DEV"),
			submenu: [
				{
					label: translate("MENU_SHOW_ROOT_PROPERTIES"),
					click: () => {
						win.webContents.send("call", {
							fn: "display_props",
							args: [true]
						});
					}
				},
				{
					label: translate("MENU_SHOW_NODE_PROPERTIES"),
					click: () => {
						win.webContents.send("call", {
							fn: "display_props",
							args: [false]
						});
					}
				},
				{
					label: translate("MENU_SHOW_ENGINE_STDERR"),
					click: () => {
						win.webContents.send("call", "display_stderr");
					}
				},
				{
					type: "separator",
				},
				{
					label: translate("MENU_ZOBRIST_MISMATCH_CHECKS"),
					type: "checkbox",
					checked: config.zobrist_checks,
					click: () => {
						win.webContents.send("toggle", "zobrist_checks");
					}
				},
				{
					label: translate("MENU_RESET_MISMATCH_WARNINGS"),
					click: () => {
						win.webContents.send("call", "reset_mismatch_warnings");
					}
				},
				{
					type: "separator",
				},
				{
					label: translate("MENU_SNAPPY_NODE_SWITCH_HACK"),
					type: "checkbox",
					checked: config.snappy_node_switch,
					click: () => {
						win.webContents.send("toggle", "snappy_node_switch");
					}
				},
				{
					type: "separator",
				},
				{
					label: translate("MENU_SHOW_CONFIG_FILE"),
					click: () => {
						electron.shell.showItemInFolder(config_io.filepath);
					}
				},
				{
					label: translate("MENU_TOGGLE_DEV_TOOLS"),
					accelerator: "CommandOrControl+Shift+I",
					role: "toggledevtools"
				},
			]
		},

		// Language menu...........................................................................

		{
			label: "Language",
			submenu: language_choices_submenu(),
		},
	];

	return electron.Menu.buildFromTemplate(template);
}

function colour_choices_submenu() {

	let ret = [];

	for (let item of colour_choices.items) {
		if (item.type === "separator") {
			ret.push({type: "separator"});
		} else {
			ret.push({
				label: item.label,
				type: "checkbox",
				checked: config.top_colour_black === item.opts.top_colour_black &&
				         config.top_colour_white === item.opts.top_colour_white &&
				         config.off_colour_black === item.opts.off_colour_black &&
				         config.off_colour_white === item.opts.off_colour_white,
				click: () => {
					win.webContents.send("call", {
						fn: "apply_colour_settings",
						args: [item.opts]
					});
				}
			});
		}
	}

	return ret;
}

function language_choices_submenu() {

	let ret = [];

	for (let language of all_languages()) {
		ret.push({
			label: language,
			type: "checkbox",
			checked: config.language === language,
			click: () => {
				win.webContents.send("set", {language: language});
			}
		});
	}

	return ret;
}

function rectangular_submenu() {

	let ret = [];

	for (let x = 19; x >= 2; x--) {
		let subsubmenu = [];
		for (let y = x; y >= 2; y--) {
			subsubmenu.push({
				label: x.toString() + " x " + y.toString(),
				click: () => {
					win.webContents.send("call", {
						fn: "new_game",
						args: [x, y]
					});
				}
			});
		}
		ret.push({
			label: x.toString(),
			submenu: subsubmenu,
		});
	}

	return ret;
}

function komi_submenu() {

	let ret = [];

	for (let komi of config.komi_options) {
		ret.push({
			label: komi.toString(),
			click: () => {
				win.webContents.send("call", {
					fn: "coerce_komi",
					args: [komi]
				});
			}
		});
	}

	ret.reverse();
	return ret;
}

function visit_submenu() {

	let ret = [];

	for (let n of config.visit_options) {
		ret.push({
			label: n.toString(),
			type: "checkbox",
			checked: config.autoanalysis_visits === n,
			click: () => {
				win.webContents.send("set", {autoanalysis_visits: n});
			}
		});
	}

	ret.reverse();
	return ret;
}

// --------------------------------------------------------------------------------------------------------------

function get_submenu_items(menupath) {

	// Not case-sensitive (or even type sensitive) in the menupath array, above.
	//
	// If the path is to a submenu, this returns a list of all items in the submenu.
	// If the path is to a specific menu item, it just returns that item.

	let ret = menu.items;

	for (let s of menupath) {

		s = stringify(s).toLowerCase();

		ret = ret.find(o => o.label.toLowerCase() === s);

		if (ret === undefined) {
			return undefined;
		}

		if (ret.submenu) {
			ret = ret.submenu.items;
		}
	}

	return ret;
}

function set_checks(menupath) {

	if (!menu_is_set) {
		return;
	}

	let items = get_submenu_items(menupath.slice(0, -1));

	if (Array.isArray(items)) {
		let desired = stringify(menupath[menupath.length - 1]).toLowerCase();
		for (let n = 0; n < items.length; n++) {
			if (items[n].checked !== undefined) {
				items[n].checked = items[n].label.toLowerCase() === desired;
			}
		}
	}
}

function set_one_check(desired_state, menupath) {

	if (!menu_is_set) {
		return;
	}

	let item = get_submenu_items(menupath);

	if (item && item.checked !== undefined) {
		item.checked = desired_state ? true : false;
	}
}

function verify_menupath(menupath) {

	if (!menu_is_set) {						// Not possible given how this is used, I think.
		return;
	}

	let result = get_submenu_items(menupath);

	if (!result) {
		alert(win, `Failed to verify menupath: ${stringify(menupath)}`);
	}
}

function fix_colour_checks(msg) {
	for (let item of colour_choices.items) {
		if (!item.opts) {
			continue;
		}
		let ok = true;
		for (let key of Object.keys(item.opts)) {
			if (item.opts[key] !== msg[key]) {
				ok = false;
				break;
			}
		}
		if (ok) {
			set_checks([translate("MENU_DISPLAY"), translate("MENU_COLOURS"), item.label]);
			return;
		}
	}
	set_checks([translate("MENU_DISPLAY"), translate("MENU_COLOURS"), "?"]);
}

// --------------------------------------------------------------------------------------------------------------

function two_process_set(key, value) {

	// For most keys we don't care that the main and renderer processes get their configs out
	// of sync as the user changes things, but this function can be used when it does matter.
	// Remember it's the renderer process that actually saves our config file.

	config[key] = value;

	let msg = {};
	msg[key] = value;					// not msg = {key: value} which makes the key "key"
	win.webContents.send("set", msg);
}

// --------------------------------------------------------------------------------------------------------------

function queued_files_spinner() {

	// The reason we do this is so that, when the user opens a bunch of files at once, they are batched up
	// into a group instead of being sent one by one, which would cause a bunch of redraws. In practice,
	// the startup process of all the second-instance apps seems to be slow enough this isn't too helpful.

	if (queued_files.length > 0) {

		// We need to focus asap before the file actually loads, because the load might generate
		// an error alert, which must happen after the focus() so the alert is on top.

		if (win.isMinimized()) {
			win.restore();			// Works regardless of whether the window was previously normal or maximized.
		}
		// win.show();				// Not sure this does anything, might even be causing bugs, see Electron #26277
		win.focus();

		win.webContents.send("call", {
			fn: "load_multifile",
			args: [queued_files]
		});

		queued_files = [];

	}

	setTimeout(queued_files_spinner, 125);
}
