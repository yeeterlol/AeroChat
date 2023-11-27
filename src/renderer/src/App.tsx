import { Routes, Route, HashRouter } from "react-router-dom";
import Login from "@renderer/pages/Login";
import Home from "@renderer/pages/Home";
import { Context } from "@renderer/util";
import { useEffect, useState } from "react";
import { State, Status } from "../../shared/types/index";
import {
	addDispatchListener,
	createWindow,
	getState,
	removeGatewayListener,
	setGatewayState,
} from "./util/ipc";
import {
	GatewayDispatchEvents,
	PresenceUpdateStatus,
} from "discord-api-types/v9";
import Notification from "./pages/Notification";
const { ipcRenderer }: { ipcRenderer: any } = window.require("electron");
import defaultPfp from "@renderer/assets/login/sample-pfp.png";
import ContextMenu from "./pages/ContextMenu";
import { DispatchEventsCustom } from "../../shared/gateway";
import Message from "./pages/Message";
import { DiscordUtil } from "./classes/DiscordUtil";
import ContactCard from "./pages/ContactCard";
const remote = window.require(
	"@electron/remote",
) as typeof import("@electron/remote");

function App(): JSX.Element {
	// on ctrl + shift + i
	useEffect(() => {
		(async () => {
			[
				(await import("@renderer/assets/ui-elements/checkbox/check.png"))
					.default,
				(await import("@renderer/assets/ui-elements/checkbox/check-hover.png"))
					.default,
				(await import("@renderer/assets/ui-elements/checkbox/check-active.png"))
					.default,
				(
					await import(
						"@renderer/assets/ui-elements/checkbox/check-disabled.png"
					)
				).default,
				(
					await import(
						"@renderer/assets/ui-elements/checkbox/check-checked.png"
					)
				).default,
				(
					await import(
						"@renderer/assets/ui-elements/checkbox/check-checked-hover.png"
					)
				).default,
				(
					await import(
						"@renderer/assets/ui-elements/checkbox/check-checked-active.png"
					)
				).default,
				(
					await import(
						"@renderer/assets/ui-elements/checkbox/check-checked-disabled.png"
					)
				).default,
				(
					await import(
						"@renderer/assets/ui-elements/checkbox/check-indeterminate.png"
					)
				).default,
				(
					await import(
						"@renderer/assets/ui-elements/checkbox/check-indeterminate-hover.png"
					)
				).default,
				(
					await import(
						"@renderer/assets/ui-elements/checkbox/check-indeterminate-active.png"
					)
				).default,
				(
					await import(
						"@renderer/assets/ui-elements/checkbox/check-indeterminate-disabled.png"
					)
				).default,
			].forEach((url) => {
				const img = new Image();
				img.src = url;
				img.style.opacity = "0";
				img.style.position = "absolute";
				img.style.pointerEvents = "none";
				img.style.zIndex = "-1";
				document.body.appendChild(img);
			});
		})();
	}, []);
	useEffect(() => {
		function keyDown(e: KeyboardEvent) {
			if (e.ctrlKey && e.shiftKey && (e.key === "I" || e.key === "i")) {
				ipcRenderer.send("open-dev-tools");
			}
		}
		function mouseDown() {
			ipcRenderer.send("close-ctx", window.location.hash);
		}
		window.addEventListener("keydown", keyDown);
		window.addEventListener("mousedown", mouseDown);
		return () => {
			window.removeEventListener("keydown", keyDown);
			window.removeEventListener("mousedown", mouseDown);
		};
	}, []);
	const initialState = getState();
	const [reactState, setReactState] = useState<State>(initialState as State);
	function setState(newState: State) {
		setGatewayState(newState);
		setReactState(newState);
	}
	useEffect(() => {
		ipcRenderer.on("set-state", (_, state) => {
			setReactState(state);
		});
		return () => {
			ipcRenderer.removeAllListeners("set-state");
		};
	}, []);
	useEffect(() => {
		DiscordUtil.updateState(reactState);
	}, [reactState]);
	useEffect(() => {
		const ids = [
			addDispatchListener(GatewayDispatchEvents.PresenceUpdate, (d) => {
				const mutState = { ...reactState };
				if (d.guild_id) {
					if (!mutState.ready.merged_presences?.guilds) return;
					const guildIndex = mutState.ready.guilds.findIndex(
						(g) => g.id === d.guild_id,
					);
					if (guildIndex === -1) return;
					const guild = mutState.ready.merged_presences.guilds[guildIndex];
					const memberIndex = guild.findIndex((m) => m.user_id === d.user.id);
					if (memberIndex !== -1)
						mutState.ready.merged_presences.guilds[guildIndex].splice(
							memberIndex,
							1,
						);
					const { user, ...rest } = d;
					mutState.ready.merged_presences.guilds[guildIndex].push({
						...(rest as any),
						user_id: d.user.id,
					});
				}
				if (!mutState?.ready?.merged_presences?.friends) return;
				let friend = mutState.ready.merged_presences.friends.find(
					(f) => (f.user?.id || f.user_id) === d.user.id,
				);
				if (!friend) {
					mutState.ready.merged_presences?.friends.push(d as any);
					setState(mutState);
					return;
				}
				mutState.ready.merged_presences.friends =
					mutState.ready.merged_presences.friends.filter(
						(f) => (f.user_id || f.user?.id) !== d.user.id,
					);
				const finalFriend = {
					status: d.status || friend.status,
					activities: d.activities || friend.activities,
					client_status: d.client_status || friend.client_status,
					user_id: d.user.id,
				};
				if (
					finalFriend.status !== PresenceUpdateStatus.Offline &&
					friend?.status === Status.Offline
				) {
					const a = reactState?.ready?.relationships?.map((r) =>
						reactState.ready.users.find((u) => u.id === r.id),
					);
					const user = a?.find((u) => u?.id === d.user.id);
					const primary = remote.screen.getPrimaryDisplay();
					// use work area size to get bottom right
					const { width, height, monX, monY } = {
						...primary.workAreaSize,
						monX: primary.bounds.x,
						monY: primary.bounds.y,
					};
					const { x, y } = {
						x: width - 200 - 28 + monX,
						y: height - 115 - 28 + monY,
					};
					createWindow({
						customProps: {
							url: `/notification?title=${encodeURIComponent(
								`${user?.global_name || user?.username} has just signed in.`,
							)}&img=${encodeURIComponent(
								user?.avatar
									? `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png`
									: defaultPfp,
							)}`,
							alwaysOnTopValue: "status",
						},
						minWidth: 0,
						minHeight: 0,
						x,
						y,
						width: 200,
						height: 115,
						frame: false,
						resizable: false,
						transparent: true,
						focusable: false,
						backgroundColor: undefined,
					});
				}
				mutState.ready.merged_presences.friends.push(finalFriend as any);
				if (mutState === reactState) return;
				setState(mutState);
			}),
		];
		return () => {
			ids.forEach((id) => removeGatewayListener(id));
		};
	}, [reactState]);
	useEffect(() => {
		(async () => {
			if (!reactState?.ready?.sessions) return;
			const session = reactState.ready.sessions[0];
			const window = remote.getCurrentWindow();
			window.setOverlayIcon(
				remote.nativeImage.createFromPath(`resources/${session.status}.ico`),
				session.status,
			);
		})();
	}, [reactState?.ready?.sessions]);
	return (
		<Context.Provider value={{ state: reactState, setState }}>
			<HashRouter>
				<Routes>
					<Route path="/" element={<Login />} />
					<Route path="/home" element={<Home />} />
					<Route path="/notification" element={<Notification />} />
					<Route path="/context-menu" element={<ContextMenu />} />
					<Route path="/message" element={<Message />} />
					<Route path="/contact-card" element={<ContactCard />} />
				</Routes>
			</HashRouter>
		</Context.Provider>
	);
}

export default App;
