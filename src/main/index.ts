import {
	app,
	shell,
	BrowserWindow,
	ipcMain,
	nativeImage,
	Menu,
	Tray,
} from "electron";
import { join } from "path";
import { electronApp, optimizer, is } from "@electron-toolkit/utils";
import main, { enable } from "@electron/remote/main";
import Store from "electron-store";
import {
	ContextMenuItem,
	ContextMenuStyle,
	PopupWindowProps,
	State,
	allCapabilities,
} from "../shared/types";
import { sendOp } from "../shared/gateway";
import {
	APIUser,
	GatewayOpcodes,
	GatewayReceivePayload,
} from "discord-api-types/v9";
import WebSocket from "ws";
import { writeFileSync } from "fs";
import { PreloadedUserSettings } from "discord-protos";

function pathToHash(path: string) {
	if (is.dev && process.env["ELECTRON_RENDERER_URL"]) {
		return `${process.env["ELECTRON_RENDERER_URL"]}#${path}`;
	} else {
		const indexPath = join(__dirname, "../renderer/index.html");
		return `file://${indexPath}#${path}`;
	}
}

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
let state: State;
let win: BrowserWindow | null;
let ctxMenu: BrowserWindow | null;
let interval: NodeJS.Timeout | null;
let trayIcon: Tray | null;

async function showContextMenu(
	id: string,
	menu: ContextMenuItem[],
	x?: number,
	y?: number,
	offsetWidth?: number,
	style?: ContextMenuStyle,
	vertical: "top" | "bottom" = "top",
	horizontal: "left" | "right" = "left",
) {
	if (!ctxMenu) return;
	if (interval) clearInterval(interval);
	ctxMenu.webContents.setWindowOpenHandler(({ url }) => {
		shell.openExternal(url);
		return { action: "deny" };
	});
	ctxMenu.setOpacity(0);
	const steps = 60;
	const timeInMs = 150;
	const time = timeInMs / steps;
	const step = 1 / steps;
	interval = setInterval(() => {
		if (!ctxMenu) return;
		const opacity = ctxMenu.getOpacity();
		if (opacity < 1) {
			ctxMenu.setOpacity(opacity + step);
		}
	}, time);
	setTimeout(() => {
		if (!ctxMenu) return;
		if (interval) clearInterval(interval);
		ctxMenu.setOpacity(1);
	}, timeInMs);
	ctxMenu.webContents.loadURL(
		pathToHash(
			`/context-menu?id=${id}&menu=${encodeURIComponent(
				JSON.stringify(menu),
			)}&x=${x || 0}&y=${y || 0}&offsetWidth=${offsetWidth || 0}&style=${
				style || ContextMenuStyle.Modern
			}&vertical=${vertical}&horizontal=${horizontal}`,
		),
	);
	ctxMenu.reload();
	// ctxMenu.webContents.openDevTools({
	// 	mode: "detach",
	// });
	ctxMenu.setIgnoreMouseEvents(false);
}

const listeners: string[] = [];

const defaultOptions: Electron.BrowserWindowConstructorOptions = {
	width: 329,
	height: 700,
	minWidth: 200,
	minHeight: 600,
	show: false,
	autoHideMenuBar: true,
	icon: nativeImage.createFromPath(`resources/icon-default.ico`),
	backgroundColor: "white",
	title: "Windows Live Messenger",
	webPreferences: {
		preload: join(__dirname, "../preload/index.js"),
		sandbox: false,
		nodeIntegration: true,
		contextIsolation: false,
		webSecurity: false,
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
	return newWindow;
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

function setState(newState: State) {
	state = newState;
	BrowserWindow.getAllWindows().forEach((window) => {
		window.webContents.send("set-state", newState);
	});
}

function createWindow(): void {
	// Create the browser window.
	const mainWindow = new BrowserWindow(defaultOptions);

	main.enable(mainWindow.webContents);
	// mainWindow.on("close", (e) => {
	// 	if (ctxMenu) {
	// 		e.preventDefault();
	// 		dialog.showMessageBoxSync(mainWindow, {
	// 			message: "Warning",
	// 			title: "Windows Live Messenger",
	// 			detail: "This window will be minimized to the system tray.",
	// 			type: "info",
	// 			noLink: true,
	// 		});
	// 		mainWindow.hide();
	// 	}
	// });
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
		mainWindow.loadURL("http://127.0.0.1:5173");
	} else {
		mainWindow.loadFile(join(__dirname, "../renderer/index.html"));
	}
	ipcMain.on("start-gateway", (_e, token: string) => {
		socket = new WebSocket("wss://gateway.discord.gg/?v=9&encoding=json");
		socket!.onopen = async () => {
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
			const res = (
				await (
					await fetch("https://discord.com/api/v9/users/@me/settings-proto/1", {
						headers: {
							Authorization: token,
						},
					})
				).json()
			).settings;
			setState({
				...state,
				userSettings: PreloadedUserSettings.fromBase64(res),
			});
		};
		socket!.onmessage = (event) => {
			if (!socket) return;
			const data = JSON.parse(event.data.toString()) as GatewayReceivePayload;
			BrowserWindow.getAllWindows().forEach((window) => {
				listeners.forEach((id) => {
					window.webContents.send(`${id}-data`, JSON.stringify(data));
				});
			});
			console.log(data.op, data.t);
			switch (data.op) {
				case GatewayOpcodes.Hello: {
					setInterval(() => {
						sendOp(GatewayOpcodes.Heartbeat, null, socket!);
					}, data.d.heartbeat_interval - 1000);
					break;
				}
				case GatewayOpcodes.Dispatch: {
					switch (data.t) {
						case "READY": {
							writeFileSync("ready.json", JSON.stringify(data.d, null, 4));
							const d = data.d as any;
							setState({
								...state,
								ready: {
									...state?.ready,
									...d,
								},
							});
							// redirect the webcontents of win
							win?.loadURL(pathToHash("/home"));
							const token = (
								state?.ready.connected_accounts.find(
									(a) => a.type === "spotify",
								) as any
							)?.access_token;
							if (!token) break;

							break;
						}
						case "READY_SUPPLEMENTAL" as any: {
							const d = data.d as any;
							writeFileSync(
								"ready_supplemental.json",
								JSON.stringify(d, null, 4),
							);
							setState({
								...state,
								ready: {
									...d,
									...state?.ready,
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
		socket?.send(data);
	});
	ipcMain.on("close-gateway", () => {
		socket?.close();
		socket = null;
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

	ipcMain.on(
		"context-menu",
		(
			e,
			id: string,
			menu: ContextMenuItem[],
			x?: number,
			y?: number,
			offsetWidth?: number,
			style?: ContextMenuStyle,
			vertical: "top" | "bottom" = "top",
			horizontal: "left" | "right" = "left",
		) => {
			showContextMenu(id, menu, x, y, offsetWidth, style, vertical, horizontal);
			ipcMain.once(`${id}-close`, (_, selectedId) => {
				e.sender.send(`${id}-close`, selectedId);
			});
			e.sender.once("blur", () => {
				ctxMenu?.setIgnoreMouseEvents(true);
				ctxMenu?.setOpacity(0);
				e.sender.send(`${id}-close`);
			});
			ipcMain.once("close-ctx", (_, href: string) => {
				if (href.includes("context-menu")) return;
				ctxMenu?.setIgnoreMouseEvents(true);
				ctxMenu?.setOpacity(0);
				e.sender.send(`${id}-close`);
			});
			BrowserWindow.fromWebContents(e.sender)?.once("move", () => {
				ctxMenu?.setIgnoreMouseEvents(true);
				ctxMenu?.setOpacity(0);
				e.sender.send(`${id}-close`);
			});
			BrowserWindow.fromWebContents(e.sender)?.once("resize", () => {
				ctxMenu?.setIgnoreMouseEvents(true);
				ctxMenu?.setOpacity(0);
				e.sender.send(`${id}-close`);
			});
			BrowserWindow.fromWebContents(e.sender)?.once("minimize", () => {
				ctxMenu?.setIgnoreMouseEvents(true);
				ctxMenu?.setOpacity(0);
				e.sender.send(`${id}-close`);
			});
			BrowserWindow.fromWebContents(e.sender)?.once("maximize", () => {
				ctxMenu?.setIgnoreMouseEvents(true);
				ctxMenu?.setOpacity(0);
				e.sender.send(`${id}-close`);
			});
		},
	);

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
	ipcMain.on("contact-card", (_e, user: APIUser, x?: number, y?: number) => {
		const win = createPopupWindow({
			customProps: {
				url: `/contact-card?user=${encodeURIComponent(JSON.stringify(user))}${
					x ? `&x=${x}` : ""
				}${y ? `&y=${y}` : ""}`,
				alwaysOnTopValue: "floating",
			},
			width: 350,
			height: 300,
			frame: false,
			resizable: false,
			minWidth: 0,
			minHeight: 0,
			hasShadow: false,
			transparent: true,
			skipTaskbar: true,
			focusable: false,
		});
		win.hide();
	});

	trayIcon = new Tray(
		nativeImage.createFromPath("resources/icon-default.ico"),
		"0a7e2c8f-a657-44ac-be2e-3906926039ed",
	);
	trayIcon.on("click", () => {
		mainWindow.show();
	});
	trayIcon.setContextMenu(
		Menu.buildFromTemplate([
			{
				label: "Show",
				click() {
					mainWindow.show();
				},
			},
			{
				label: "Exit",
				click() {
					BrowserWindow.getAllWindows().forEach((window) => {
						window.destroy();
					});
					if (!ctxMenu?.isDestroyed()) ctxMenu?.destroy();
					app.quit();
					trayIcon?.destroy();
				},
			},
		]),
	);
	win = mainWindow;
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

	ctxMenu = new BrowserWindow({
		minWidth: 0,
		minHeight: 0,
		width: 0,
		height: 0,
		frame: false,
		resizable: false,
		transparent: true,
		focusable: false,
		skipTaskbar: true,
		backgroundColor: undefined,
		webPreferences: {
			preload: join(__dirname, "../preload/index.js"),
			sandbox: false,
			nodeIntegration: true,
			contextIsolation: false,
		},
	});
	enable(ctxMenu.webContents);
	ctxMenu.setAlwaysOnTop(true, "status");
	ctxMenu.setOpacity(0);
	ctxMenu.show();
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
