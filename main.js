"use strict";

const electron = require("electron");
const path = require("path");
const url = require("url");

const config_io = require("./modules/config_io");
const stringify = require("./modules/stringify");

config_io.load();
let config = config_io.config;

let menu = menu_build();
let win;						// We're supposed to keep global references to every window we make.

if (electron.app.isReady()) {
	startup();
} else {
	electron.app.once("ready", () => {
		startup();
	});
}

// --------------------------------------------------------------------------------------------------------------

const save_dialog = electron.dialog.showSaveDialogSync || electron.dialog.showSaveDialog;
const open_dialog = electron.dialog.showOpenDialogSync || electron.dialog.showOpenDialog;

function alert(msg) {
	electron.dialog.showMessageBox({message: stringify(msg), title: "Alert", buttons: ["OK"]}, () => {});
	// Providing a callback makes the window not block the process.
};

function startup() {

	win = new electron.BrowserWindow({
		width: config.width,
		height: config.height,
		backgroundColor: "#000000",
		resizable: true,
		show: false,
		useContentSize: true,
		webPreferences: {
			backgroundThrottling: false,
			contextIsolation: false,
			nodeIntegration: true,
			spellcheck: false,
			zoomFactor: 1 / electron.screen.getPrimaryDisplay().scaleFactor		// Unreliable, see https://github.com/electron/electron/issues/10572
		}
	});

	win.once("ready-to-show", () => {
		try {
			win.webContents.setZoomFactor(1 / electron.screen.getPrimaryDisplay().scaleFactor);	// This seems to work, note issue 10572 above.
		} catch (err) {
			win.webContents.zoomFactor = 1 / electron.screen.getPrimaryDisplay().scaleFactor;	// The method above "will be removed" in future.
		}
		win.show();
		win.focus();
	});

	electron.app.on("window-all-closed", () => {
		electron.app.quit();
	});

	electron.ipcMain.on("alert", (event, msg) => {
		alert(msg);
	});

	electron.ipcMain.on("set_title", (event, msg) => {
		win.setTitle(msg);
	});

	// Actually load the page last, I guess, so the event handlers above are already set up.
	// Send some possibly useful info as a query.

	let query = {};
	query.user_data_path = electron.app.getPath("userData");

	win.loadFile(
		path.join(__dirname, "ogatak.html"),
		{query: query}
	);

	electron.Menu.setApplicationMenu(menu);
}

// --------------------------------------------------------------------------------------------------------------

function menu_build() {
	const template = [
		{
			label: "App",
			submenu: [
				{
					label: "About",
					click: () => {
						alert(`${electron.app.getName()} (${electron.app.getVersion()}) in Electron (${process.versions.electron})`);
					}
				},
				{
					type: "separator",
				},
				{
					label: "Open SGF...",
					accelerator: "CommandOrControl+O",
					click: () => {
						let files = open_dialog();
						if (Array.isArray(files) && files.length > 0) {
							win.webContents.send("call", {
								fn: "load",
								args: [files[0]]
							});
						}
					}
				},
				{
					type: "separator",
				},
				{
					label: "Choose engine...",
					click: () => {
						let files = open_dialog();
						if (Array.isArray(files) && files.length > 0) {
							let file = files[0];
							win.webContents.send("set", {
								key: "engine",
								value: file
							});
							alert("This requires a restart to take effect.");		// FIXME
						}
					},
				},
				{
					label: "Choose engine config...",
					click: () => {
						let files = open_dialog();
						if (Array.isArray(files) && files.length > 0) {
							let file = files[0];
							win.webContents.send("set", {
								key: "engineconfig",
								value: file
							});
							alert("This requires a restart to take effect.");		// FIXME
						}
					},
				},
				{
					label: "Choose weights...",
					click: () => {
						let files = open_dialog();
						if (Array.isArray(files) && files.length > 0) {
							let file = files[0];
							win.webContents.send("set", {
								key: "weights",
								value: file
							});
							alert("This requires a restart to take effect.");		// FIXME
						}
					},
				},
				{
					type: "separator",
				},
				{
					label: "Quit",
					accelerator: "CommandOrControl+Q",
					role: "quit"
				},
			]
		},
		{
			label: "Tree",
			submenu: [
				{
					label: "Root",
					accelerator: "Home",
					click: () => {
						win.webContents.send("call", "go_to_root");
					}
				},
				{
					label: "End",
					accelerator: "End",
					click: () => {
						win.webContents.send("call", "go_to_end");
					}
				},
				{
					label: "Backward",
					accelerator: "Left",
					click: () => {
						win.webContents.send("call", "prev");
					}
				},
				{
					label: "Forward",
					accelerator: "Right",
					click: () => {
						win.webContents.send("call", "next");
					}
				},
				{
					type: "separator",
				},
				{
					label: "Previous sibling",
					accelerator: "Up",
					click: () => {
						win.webContents.send("call", "prev_sibling");
					}
				},
				{
					label: "Next sibling",
					accelerator: "Down",
					click: () => {
						win.webContents.send("call", "next_sibling");
					}
				},
				{
					type: "separator",
				},
				{
					label: "Return to main line",
					accelerator: "CommandOrControl+R",
					click: () => {
						win.webContents.send("call", "return_to_main");
					}
				},
			]
		},
		{
			label: "Analysis",
			submenu: [
				{
					label: "Go",
					accelerator: "CommandOrControl+G",
					click: () => {
						win.webContents.send("call", "go");
					}
				},
				{
					label: "Halt",
					accelerator: "CommandOrControl+H",
					click: () => {
						win.webContents.send("call", "halt");
					}
				},
			]
		},
		{
			label: "Dev",
			submenu: [
				{
					role: "toggledevtools"
				},
				{
					label: `Show ${config_io.filename}`,
					click: () => {
						electron.shell.showItemInFolder(config_io.filepath);
					}
				},
			]
		}
	];

	return electron.Menu.buildFromTemplate(template);
}

