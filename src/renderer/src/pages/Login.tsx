import styles from "@renderer/css/pages/Login.module.css";
import { ChangeEvent, useContext, useEffect, useRef, useState } from "react";
import Vibrant from "node-vibrant";
import pfp from "@renderer/assets/login/sample-pfp.png";
import { closeGateway, startGateway } from "@renderer/util/ipc";
import { Context } from "@renderer/util";
const remote = window.require(
	"@electron/remote",
) as typeof import("@electron/remote");
const Store = window.require(
	"electron-store",
) as typeof import("electron-store");
import speen from "@renderer/assets/login/speen.png";

function hexToPixelImage(hexCode: string) {
	const canvas = document.createElement("canvas");
	canvas.width = 1;
	canvas.height = 1;
	const ctx = canvas.getContext("2d")!;
	ctx.fillStyle = hexCode;
	ctx.globalAlpha = 0.25;
	ctx.fillRect(0, 0, 1, 1);
	const d = canvas.toDataURL();
	return d;
}

const SecurePassword = ({
	value,
	onChange,
	mask = "*",
	placeholder = "",
	className = "",
}: {
	value: string;
	onChange: (value: string) => void;
	mask?: string;
	placeholder?: string;
	className?: string;
}) => {
	let updatePass = (e: ChangeEvent<HTMLInputElement>) => {
		let newValue = e.target.value;
		// Account for multi-character unicode masks
		let newLength = newValue.length / mask.length;
		let oldLength = value.length * mask.length;

		// NOTE: This assumes all edits happen at the end of the password.
		// To support mid word character adding, we can find the current cursor position using refs
		// The idea is to determine the start and stop based on the cursor position to slice the newValue and splice it into value at the same spot. It's complicated by the emoji support since those have length > 1

		// We've added characters at the end
		if (value.length < newLength) onChange(value + newValue.slice(oldLength));

		// We've removed characters from the end
		if (value.length > newLength) onChange(value.slice(0, newLength));
	};

	return (
		<input
			value={mask.repeat(value.length)}
			onKeyDown={(e) => {
				// prevent arrow keys from moving the cursor
				if (e.key.startsWith("Arrow")) e.preventDefault();
			}}
			onMouseDown={(e) => {
				if (e.target === document.activeElement) e.preventDefault();
			}}
			onChange={updatePass}
			placeholder={placeholder}
			className={className}
		/>
	);
};

function isTokenPotentiallyValid(token: string): boolean {
	if (token.split(".").length !== 3) return false;
	try {
		const decoded = atob(token.split(".")[0]);
		return decoded.length > 16;
	} catch {
		return false;
	}
}

interface IUser {
	accent_color: string | null;
	avatar: string | null;
	avatar_decoration: string | null;
	desktop: boolean;
	discriminator: string;
	display_name: string;
	email: string;
	flags: any;
	global_name: string;
	id: string;
	mfa_enabled: boolean;
	mobile: boolean;
	nsfw_allowed: boolean;
	phone: string;
	premium: boolean;
	premium_type: number;
	premium_usage_flags: number;
	public_flags: any;
	purchased_flags: number;
	username: string;
	system: boolean;
	verified: boolean;
	bot: boolean;
	theme_colors: number[];
}

const store = new Store();

function Login(): JSX.Element {
	const [saveToken, setSaveToken] = useState(false);
	const [autoLogin, setAutoLogin] = useState(false);
	const [clicked, setClicked] = useState(false);
	const [token, setToken] = useState(
		store.get("token")
			? remote.safeStorage.decryptString(
					Buffer.from((store.get("token") as any)?.data || ""),
			  )
			: "",
	);
	const [userInfo, setUserInfo] = useState<IUser>();
	const [checkedAutoLogin, setCheckedAutoLogin] = useState(false);
	const { state, setState } = useContext(Context);
	useEffect(() => {
		if (checkedAutoLogin) return;
		setCheckedAutoLogin(true);
		if (store.get("autoLogin")) {
			(document.getElementById("save-token") as HTMLInputElement).checked =
				true;
			setSaveToken(true);
			setAutoLogin(true);
			// we need to get and decrypt the token ourselves from the store
			const token = remote.safeStorage.decryptString(
				Buffer.from((store.get("token") as any)?.data || ""),
			);
			startGateway(token);
			setState({ ...state, token });
			setClicked(true);
		}
	}, [checkedAutoLogin, state]);
	const pfpRef = useRef<HTMLDivElement>(null);
	useEffect(() => {
		store.set("autoLogin", autoLogin);
	}, [autoLogin]);
	useEffect(() => {
		if (isTokenPotentiallyValid(token)) {
			setUserInfo({
				global_name: "Loading...",
			} as any);
			(async () => {
				const req = await fetch(`https://discord.com/api/v9/users/@me`, {
					headers: {
						Authorization: token,
					},
				});
				const res = (await req.json()) as IUser;
				if (res.id) {
					if (pfpRef.current) {
						let url = res?.avatar
							? `https://cdn.discordapp.com/avatars/${res.id}/${res.avatar}.png?size=256`
							: pfp;
						pfpRef.current.style.setProperty("--data-url", `url(${url})`);
						const vibrant = Vibrant.from(url);
						const color = await vibrant.getPalette();
						pfpRef.current.style.setProperty(
							"--background",
							`url(${hexToPixelImage(color.DarkMuted?.hex || "#000")})`,
						);
					}
				} else {
					setUserInfo(undefined);
					if (pfpRef.current) {
						pfpRef.current.style.setProperty(
							"--background",
							`url("data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVQIW2P4DwQACfsD/Z8fLAAAAAAASUVORK5CYII=")`,
						);
						pfpRef.current.style.setProperty("--data-url", `url(${pfp})`);
					}
				}
				setUserInfo(res);
			})();
		} else {
			setUserInfo(undefined);
			if (pfpRef.current) {
				pfpRef.current.style.setProperty(
					"--background",
					`url("data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVQIW2P4DwQACfsD/Z8fLAAAAAAASUVORK5CYII=")`,
				);
				pfpRef.current.style.setProperty("--data-url", `url(${pfp})`);
			}
		}
	}, [token]);
	useEffect(() => {
		console.log(remote.getCurrentWindow().getSize());
	}, []);
	return (
		<div className={styles.window}>
			<div className={styles.pfp} ref={pfpRef} />
			<div className={styles.heading}>
				{clicked ? "Signing in..." : "Sign in"}
			</div>
			<div className={styles.content}>
				<div
					className={styles.hero}
					style={{
						display: clicked ? "none" : undefined,
					}}
				>
					Sign in with your Discord token. Don't have an account?{" "}
					<a href="https://discord.com/login" target="_blank">
						Create one.
					</a>
				</div>
				{/* <div className={styles.hero}>
					Sign in with your Windows Live ID. Don't have one? Sign up.
				</div> */}
				<div
					className={styles.form}
					style={{
						display: clicked ? "none" : undefined,
					}}
				>
					<SecurePassword
						placeholder="Enter your token"
						value={token}
						onChange={(e) => setToken(e)}
					/>
					{token !== "" ? (
						userInfo?.id ? (
							<div>
								This token will sign you in as:{" "}
								<b>{userInfo?.global_name || userInfo?.username}</b>
								<div className={styles.footer}>
									Your token will be securely encrypted on disk for future
									logins.
								</div>
							</div>
						) : userInfo?.username || userInfo?.global_name ? (
							<div>Verifying...</div>
						) : (
							<div>
								<b>Error:</b> The token you entered is invalid.
								<div
									style={{
										marginTop: 8,
									}}
								>
									<a
										target="_blank"
										href="https://www.androidauthority.com/get-discord-token-3149920/"
									>
										How do I get my Discord token?
									</a>
								</div>
							</div>
						)
					) : (
						<div>
							<a
								target="_blank"
								href="https://www.androidauthority.com/get-discord-token-3149920/"
							>
								How do I get my Discord token?
							</a>
						</div>
					)}
					<div className={styles.checkInput}>
						<input
							disabled={clicked}
							id="save-token"
							className={styles.check}
							type="checkbox"
							onChange={(e) => {
								setSaveToken(e.target.checked);
								if (!e.target.checked) {
									(
										document.getElementById("auto-login") as HTMLInputElement
									).checked = false;
									setAutoLogin(false);
								}
							}}
							defaultChecked={!!store.get("token")}
						/>
						<label htmlFor="save-token">Remember me</label>
						<a
							onClick={(e) => {
								e.preventDefault();
								e.stopPropagation();
								store.delete("token");
								setToken("");
								(
									document.getElementById("save-token") as HTMLInputElement
								).checked = false;

								remote.dialog.showMessageBoxSync(remote.getCurrentWindow(), {
									message: "Forgotten",
									title: "Windows Live Messenger",
									detail: "Your token has been forgotten.",
									type: "info",
									noLink: true,
								});
							}}
						>
							(Forget me)
						</a>
					</div>
					<div className={styles.checkInput}>
						<input
							disabled={!saveToken}
							id="auto-login"
							className={styles.check}
							type="checkbox"
							onChange={(e) => setAutoLogin(e.target.checked)}
							defaultChecked={!!store.get("token")}
						/>
						<label htmlFor="auto-login">Automatically log me in</label>
					</div>
				</div>
				<img
					src={speen}
					className={styles.speen}
					style={{
						display: clicked ? undefined : "none",
					}}
				/>
				<button
					onClick={() => {
						if (clicked) {
							closeGateway();
							setState({} as any);
							setClicked(false);
						} else {
							startGateway(token);
							setState({ ...state, token });
							setClicked(true);
							const save = (
								document.getElementById("save-token") as HTMLInputElement
							)?.checked;
							if (save) {
								store.set("token", remote.safeStorage.encryptString(token));
							} else {
								store.delete("token");
							}
						}
					}}
					className={styles.signIn}
				>
					{clicked ? "Cancel" : "Sign in"}
				</button>
			</div>
			<div className={styles.windowFooter}>
				<a href="https://discord.gg/2KJhWjRV85" target="_blank">
					Join our Discord server!
				</a>
				{" | "}
				<div>made by notnullptr</div>
			</div>
		</div>
	);
}

export default Login;
