import { Routes, Route, HashRouter } from "react-router-dom";
import Login from "@renderer/pages/Login";
import Home from "@renderer/pages/Home";
import { Context } from "@renderer/util";
import { useState } from "react";
import { State } from "../../shared/types/index";
import { getState, setGatewayState } from "./util/ipc";
const { ipcRenderer }: { ipcRenderer: any } = window.require("electron");

function App(): JSX.Element {
	const initialState = getState();
	const [reactState, setReactState] = useState<State>(initialState as State);
	function setState(newState: State) {
		setGatewayState(newState);
		setReactState(newState);
	}
	ipcRenderer.on("set-state", (_, state) => {
		setReactState({
			...JSON.parse(state),
		});
	});
	return (
		<Context.Provider value={{ state: reactState, setState }}>
			<HashRouter>
				<Routes>
					<Route path="/" element={<Login />} />
					<Route path="/home" element={<Home />} />
				</Routes>
			</HashRouter>
		</Context.Provider>
	);
}

export default App;
