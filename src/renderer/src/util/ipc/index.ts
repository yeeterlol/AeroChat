const { ipcRenderer } = require("electron");
import {
	GatewayDispatchEvents,
	GatewayOpcodes,
	GatewayReceivePayload,
} from "discord-api-types/v9";
import {
	DispatchData,
	DispatchEventsCustom,
	OpcodeReceiveData,
} from "src/shared/gateway";
import {
	ContextMenuItem,
	PopupWindowProps,
	State,
} from "../../../../shared/types";
import { v4 } from "uuid";

export function startGateway(token: string) {
	ipcRenderer.send("start-gateway", token);
}

export function getState(): State {
	return ipcRenderer.sendSync("get-state");
}

export function setGatewayState(newState: State) {
	ipcRenderer.send("set-state", newState);
}

// const eventListeners: {
//     cb: (data: any) => void;
//     opcode: GatewayReceiveOpcode;
//     id: string;
// }[] = [];

export function addGatewayListener<T extends GatewayOpcodes>(
	opcode: T,
	cb: (data: OpcodeReceiveData<T>) => void,
): string {
	const id = v4();
	ipcRenderer.send("add-gateway-listener", id);
	ipcRenderer.on(`${id}-data`, (_: any, dataStr: string) => {
		const data = JSON.parse(dataStr);
		if (data.op === opcode) cb(data.d);
	});
	ipcRenderer.on(`${id}-remove`, (_: any) => {
		ipcRenderer.removeAllListeners(`${id}-data`);
		ipcRenderer.removeAllListeners(`${id}-remove`);
	});
	return id;
}

export function addDispatchListener<
	T extends GatewayDispatchEvents | DispatchEventsCustom,
>(event: T, cb: (data: DispatchData<T>) => void): string {
	const id = v4();
	ipcRenderer.send("add-gateway-listener", id);
	ipcRenderer.on(`${id}-data`, (_: any, dataStr: string) => {
		const data: GatewayReceivePayload = JSON.parse(dataStr);
		if (data.op === GatewayOpcodes.Dispatch && data.t == event)
			cb(data.d as any);
	});
	ipcRenderer.on(`${id}-remove`, (_: any) => {
		ipcRenderer.removeAllListeners(`${id}-data`);
		ipcRenderer.removeAllListeners(`${id}-remove`);
	});
	return id;
}

export function createWindow(props: PopupWindowProps) {
	ipcRenderer.send("create-window", props);
}

export function removeGatewayListener(id: string): void {
	ipcRenderer.send("remove-gateway-listener", id);
	ipcRenderer.removeAllListeners(`${id}-data`);
	ipcRenderer.removeAllListeners(`${id}-remove`);
}

export function closeGateway() {
	ipcRenderer.send("close-gateway");
}

export async function contextMenu(
	items: ContextMenuItem[],
	x?: number,
	y?: number,
	offsetWidth?: number,
): Promise<void> {
	const id = v4();
	const idItems = items.map((i) => ({ ...i, id: v4() }));
	ipcRenderer.send(
		"context-menu",
		id,
		idItems.map(({ click, ...rest }) => rest),
		x,
		y,
		offsetWidth,
	);
	return new Promise((resolve) => {
		ipcRenderer.once(`${id}-close`, (_, id: string) => {
			idItems.find((i) => i.id === id)?.click();
			resolve();
		});
	});
}
