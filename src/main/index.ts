import { app, shell, BrowserWindow, ipcMain } from "electron";
import { join } from "path";
import { electronApp, optimizer, is } from "@electron-toolkit/utils";
import icon from "../../resources/icon.png?asset";
import main, { enable } from "@electron/remote/main";
import Store from "electron-store";
import { PopupWindowProps, State, allCapabilities } from "../shared/types";
import { sendOp } from "../shared/gateway";
import { GatewayOpcodes, GatewayReceivePayload } from "discord-api-types/v9";
import WebSocket from "ws";
import { writeFileSync } from "fs";

export const mergeObjects = <T extends object = object>(
	target: T,
	...sources: T[]
): T => {
	if (!sources.length) {
		return target;
	}
	const source = sources.shift();
	if (source === undefined) {
		return target;
	}

	if (isMergebleObject(target) && isMergebleObject(source)) {
		Object.keys(source).forEach(function (key: string) {
			if (isMergebleObject(source[key])) {
				if (!target[key]) {
					target[key] = {};
				}
				mergeObjects(target[key], source[key]);
			} else {
				target[key] = source[key];
			}
		});
	}

	return mergeObjects(target, ...sources);
};

const isObject = (item: any): boolean => {
	return item !== null && typeof item === "object";
};

const isMergebleObject = (item): boolean => {
	return isObject(item) && !Array.isArray(item);
};

main.initialize();
Store.initRenderer();

let socket: WebSocket | null;
let state: State | null;

const listeners: string[] = [];

const defaultOptions: Electron.BrowserWindowConstructorOptions = {
	width: 273,
	height: 477,
	show: false,
	autoHideMenuBar: true,
	...(process.platform === "linux" ? { icon } : {}),
	webPreferences: {
		preload: join(__dirname, "../preload/index.js"),
		sandbox: false,
		nodeIntegration: true,
		contextIsolation: false,
	},
};

function findWindowFromPath(path: string): BrowserWindow | undefined {
	for (const window of BrowserWindow.getAllWindows()) {
		const url = new URL(window.webContents.getURL());
		if (url.hash.replace("#", "") === path) {
			return window;
		}
	}
	return undefined;
}

function createPopupWindow(props: PopupWindowProps) {
	const newWindow = new BrowserWindow({
		...defaultOptions,
		...props,
	});
	enable(newWindow.webContents);
	props.customProps.alwaysOnTopValue &&
		newWindow.setAlwaysOnTop(true, props.customProps.alwaysOnTopValue);
	newWindow.webContents.setWindowOpenHandler(({ url }) => {
		shell.openExternal(url);
		return { action: "deny" };
	});
	if (is.dev && process.env["ELECTRON_RENDERER_URL"]) {
		newWindow.loadURL(
			`${process.env["ELECTRON_RENDERER_URL"]}#${props.customProps.url}`,
		);
	} else {
		const indexPath = join(__dirname, "../renderer/index.html");
		newWindow.loadURL(`file://${indexPath}#${props.customProps.url}`);
	}
	newWindow.on("ready-to-show", () => {
		optimizer.watchWindowShortcuts(newWindow);
		newWindow.show();
	});
	newWindow.removeMenu();
}

function createOrFocusWindow(props: PopupWindowProps) {
	const existingWindow = findWindowFromPath(props.customProps.url);
	if (existingWindow) {
		existingWindow.show();
		existingWindow.focus();
	} else {
		createPopupWindow(props);
	}
}

function setState(newState: any) {
	state = newState;
	BrowserWindow.getAllWindows().forEach((window) => {
		window.webContents.send("set-state", newState);
	});
}

function createWindow(): void {
	// Create the browser window.
	const mainWindow = new BrowserWindow(defaultOptions);

	main.enable(mainWindow.webContents);

	mainWindow.on("ready-to-show", () => {
		mainWindow.show();
	});

	mainWindow.webContents.setWindowOpenHandler((details) => {
		shell.openExternal(details.url);
		return { action: "deny" };
	});

	// HMR for renderer base on electron-vite cli.
	// Load the remote URL for development or the local html file for production.
	if (is.dev && process.env["ELECTRON_RENDERER_URL"]) {
		mainWindow.loadURL(process.env["ELECTRON_RENDERER_URL"]);
	} else {
		mainWindow.loadFile(join(__dirname, "../renderer/index.html"));
	}
	ipcMain.on("start-gateway", (_e, token: string) => {
		socket = new WebSocket("wss://gateway.discord.gg/?v=9&encoding=json");
		socket!.onopen = () => {
			sendOp(
				GatewayOpcodes.Identify,
				{
					token: token,
					capabilities: allCapabilities,
					properties: {
						os: "Linux",
						browser: "Chrome",
						device: "",
						system_locale: "en-GB",
						browser_user_agent:
							"Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36",
						browser_version: "119.0.0.0",
						os_version: "",
						referrer: "",
						referring_domain: "",
						referrer_current: "",
						referring_domain_current: "",
						release_channel: "stable",
						client_build_number: 245648,
						client_event_source: null,
					},
					presence: {
						status: "unknown",
						since: 0,
						activities: [],
						afk: false,
					},
					compress: false,
					client_state: {
						guild_versions: {},
						highest_last_message_id: "0",
						read_state_version: 0,
						user_guild_settings_version: -1,
						user_settings_version: -1,
						private_channels_version: "0",
						api_code_version: 0,
					},
				} as any,
				socket!,
			);
		};
		socket!.onmessage = (event) => {
			const data = JSON.parse(event.data.toString()) as GatewayReceivePayload;
			BrowserWindow.getAllWindows().forEach((window) => {
				listeners.forEach((id) => {
					window.webContents.send(`${id}-data`, JSON.stringify(data));
				});
			});
			console.log(data.t, data.op);
			switch (data.op) {
				case GatewayOpcodes.Hello: {
					setInterval(() => {
						sendOp(GatewayOpcodes.Heartbeat, null, socket!);
					}, data.d.heartbeat_interval);
					break;
				}
				case GatewayOpcodes.Dispatch: {
					switch (data.t) {
						case "READY": {
							writeFileSync("ready.json", JSON.stringify(data.d, null, 4));
							break;
						}
						case "READY_SUPPLEMENTAL" as any: {
							const d = data.d as any;
							setState({
								...state,
								ready: {
									...state?.ready,
									...d,
								},
							});
							break;
						}
						case "PRESENCE_UPDATE": {
							writeFileSync("presence.json", JSON.stringify(data.d, null, 4));
							break;
						}
					}
				}
				default: {
					// unimplemented
				}
			}
		};
	});
	ipcMain.on("send-op", (_e, data: string) => {
		console.log("sent");
		console.log(data);
		socket!.send(data);
	});
	ipcMain.on("close-gateway", () => {
		socket!.close();
	});

	ipcMain.on("set-state", (_e, newState) => {
		setState(newState);
	});

	ipcMain.on("get-state", (_e) => {
		_e.returnValue = state;
	});

	ipcMain.on("add-gateway-listener", (_e, id: string) => {
		listeners.push(id);
	});

	ipcMain.on("open-dev-tools", (e) => {
		e.sender.openDevTools();
	});

	ipcMain.on("remove-gateway-listener", (_e, id: string) => {
		listeners.splice(listeners.indexOf(id), 1);
		BrowserWindow.getAllWindows().forEach((window) => {
			window.webContents.send(`${id}-remove`);
		});
	});

	ipcMain.on("create-window", (_e, props: PopupWindowProps) => {
		props.customProps.checkForDupes
			? createOrFocusWindow(props)
			: createPopupWindow(props);
	});
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(() => {
	// Set app user model id for windows
	electronApp.setAppUserModelId("com.electron");

	// Default open or close DevTools by F12 in development
	// and ignore CommandOrControl + R in production.
	// see https://github.com/alex8088/electron-toolkit/tree/master/packages/utils

	createWindow();

	app.on("activate", function () {
		// On macOS it's common to re-create a window in the app when the
		// dock icon is clicked and there are no other windows open.
		if (BrowserWindow.getAllWindows().length === 0) createWindow();
	});
});

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on("window-all-closed", () => {
	if (process.platform !== "darwin") {
		app.quit();
	}
});

// In this file you can include the rest of your app"s specific main process
// code. You can also put them in separate files and require them here.
