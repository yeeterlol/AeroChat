const { ipcRenderer } = require("electron");
import {
	GatewayDispatchEvents,
	GatewayOpcodes,
	GatewayReceivePayload,
} from "discord-api-types/v9";
import { DispatchData, OpcodeReceiveData } from "src/shared/gateway";
import { PopupWindowProps, State } from "src/shared/types";
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

export function addDispatchListener<T extends GatewayDispatchEvents>(
	event: T,
	cb: (data: DispatchData<T>) => void,
): string {
	const id = v4();
	ipcRenderer.send("add-gateway-listener", id);
	ipcRenderer.on(`${id}-data`, (_: any, dataStr: string) => {
		const data: GatewayReceivePayload = JSON.parse(dataStr);
		if (data.op === GatewayOpcodes.Dispatch && data.t === event)
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
