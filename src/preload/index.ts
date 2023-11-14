import { contextBridge } from "electron";

export const apis = {};

// context bridge
contextBridge.exposeInMainWorld("api", apis);
