import { app, shell, BrowserWindow, ipcMain } from "electron";
import { join } from "path";
import { electronApp, optimizer, is } from "@electron-toolkit/utils";
import icon from "../../resources/icon.png?asset";
import main from "@electron/remote/main";
import Store from "electron-store";
import { State } from "../shared/types";
import { sendOp } from "../shared/gateway";
import {
	GatewayOpcodes,
	GatewayReceivePayload,
	PresenceUpdateStatus,
} from "discord-api-types/v9";
import WebSocket from "ws";

const debug = true;
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

function createPopupWindow(
	url: string,
	width?: number,
	height?: number,
	resizable: boolean = true,
) {
	const newWindow = new BrowserWindow({
		...defaultOptions,
		width: width || defaultOptions.width,
		height: height || defaultOptions.height,
		resizable: debug ? true : resizable,
	});
	newWindow.webContents.setWindowOpenHandler(({ url }) => {
		shell.openExternal(url);
		return { action: "deny" };
	});
	if (is.dev && process.env["ELECTRON_RENDERER_URL"]) {
		newWindow.loadURL(`${process.env["ELECTRON_RENDERER_URL"]}#${url}`);
	} else {
		const indexPath = join(__dirname, "../renderer/index.html");
		newWindow.loadURL(`file://${indexPath}#${url}`);
	}
	newWindow.on("blur", () => {
		newWindow?.webContents.executeJavaScript(
			`document.querySelector('.titlebar').classList.add('inactive');`,
		);
	});

	newWindow.on("focus", () => {
		newWindow?.webContents.executeJavaScript(
			`document.querySelector('.titlebar').classList.remove('inactive');`,
		);
	});
	newWindow.removeMenu();
}

function createOrFocusWindow(
	url: string,
	width?: number,
	height?: number,
	resizable: boolean = true,
) {
	const existingWindow = findWindowFromPath(url);
	if (existingWindow) {
		existingWindow.show();
		existingWindow.focus();
	} else {
		createPopupWindow(url, width, height, resizable);
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
	app.on("browser-window-created", (_, window) => {
		optimizer.watchWindowShortcuts(window);
	});

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

ipcMain.on("start-gateway", (_e, token: string) => {
	socket = new WebSocket("wss://gateway.discord.gg/?v=9&encoding=json");
	socket!.onopen = () => {
		sendOp(socket!, GatewayOpcodes.Identify, {
			token: token,
			properties: {
				os: "Windows",
				browser: "Firefox",
				device: "",
			},
			presence: {
				status: PresenceUpdateStatus.Online,
				since: 0,
				activities: [],
				afk: false,
			},
			compress: false,
			intents: null as any, // we don't care about intents, we're not a bot
		});
	};
	socket!.onmessage = (event) => {
		const data = JSON.parse(event.data.toString()) as GatewayReceivePayload;
		BrowserWindow.getAllWindows().forEach((window) => {
			listeners.forEach((id) => {
				window.webContents.send(`${id}-data`, JSON.stringify(data));
			});
		});
		switch (data.op) {
			case GatewayOpcodes.Hello: {
				setInterval(() => {
					sendOp(socket!, GatewayOpcodes.Heartbeat, null);
				}, data.d.heartbeat_interval);
				break;
			}
			default: {
				// unimplemented
			}
		}
	};
});

ipcMain.on("close-gateway", () => {
	socket!.close();
});

ipcMain.on("set-state", (_e, newState: string) => {
	setState(newState);
});

ipcMain.on("get-state", (_e) => {
	_e.returnValue = state;
});

ipcMain.on("add-gateway-listener", (_e, id: string) => {
	listeners.push(id);
});

ipcMain.on("remove-gateway-listener", (_e, id: string) => {
	listeners.splice(listeners.indexOf(id), 1);
	BrowserWindow.getAllWindows().forEach((window) => {
		window.webContents.send(`${id}-remove`);
	});
});

ipcMain.on(
	"create-window",
	(
		_e,
		url: string,
		width?: number,
		height?: number,
		resizable: boolean = true,
		checkForDupes: boolean = true,
	) => {
		checkForDupes
			? createOrFocusWindow(url, width, height, resizable)
			: createPopupWindow(url, width, height, resizable);
	},
);

// In this file you can include the rest of your app"s specific main process
// code. You can also put them in separate files and require them here.
