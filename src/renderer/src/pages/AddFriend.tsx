import styles from "@renderer/css/pages/AddFriend.module.css";
import { useContext, useEffect, useState } from "react";
import speen from "@renderer/assets/login/speen.png";
import { Context } from "@renderer/util";
import HCaptcha from "@hcaptcha/react-hcaptcha";

enum SendState {
	Unsent,
	Sending,
	Sent,
	Captcha,
}

function AddFriend() {
	const click = async (e: any, captchaKey?: string) => {
		// split at last # for discriminator
		const discriminator = parseInt(
			(name.includes("#") ? name.split("#").at(-1) : "Placeholder") ||
				"Placeholder",
		);
		const username = name.includes("#")
			? name.split("#").slice(0, -1).join("#")
			: name;
		setSendState(SendState.Sending);
		try {
			const res = await fetch(
				`https://discord.com/api/v9/users/@me/relationships`,
				{
					body: JSON.stringify(
						Number.isNaN(discriminator)
							? { username }
							: {
									username,
									discriminator,
							  },
					),
					method: "POST",
					headers: captchaKey
						? {
								"Content-Type": "application/json",
								Authorization: state.token,
								"X-Captcha-Key": captchaKey,
						  }
						: {
								"Content-Type": "application/json",
								Authorization: state.token,
						  },
				},
			);
			if (res.status !== 204) {
				const body = await res.json();
				if (body.captcha_key?.[0] === "captcha-required") {
					setCaptchaInfo(body);
					setSendState(SendState.Captcha);
					return;
				}
				setUsername("");
				setError(
					"An error occurred while sending the invitation. If the user exists, then you encountered a CAPTCHA which unfortunately cannot be bypassed. I can't fix this, sorry.",
				);
				throw new Error();
			}
		} catch {
			setSendState(SendState.Unsent);
			return;
		}
		setSendState(SendState.Sent);
	};
	const { state } = useContext(Context);
	const [name, setUsername] = useState("");
	const [sendState, setSendState] = useState<SendState>(SendState.Unsent);
	const [error, setError] = useState("");
	const [captchaInfo, setCaptchaInfo] = useState<{
		captcha_key: string[];
		captcha_sitekey: string;
		captcha_service: string;
		captcha_rqdata: string;
		captcha_rqtoken: string;
	}>();
	return (
		<div className={styles.window}>
			<div>
				<div className={styles.contents}>
					{(() => {
						switch (sendState) {
							case SendState.Unsent:
								return (
									<div>
										<h1>Enter the person's information</h1>
										<p>
											Enter an instant messaging username. When you add someone
											to Messenger, it sends a request to them which they may
											deny without notification.
										</p>
									</div>
								);
							case SendState.Sending:
								return (
									<div>
										<h1>Sending invitation...</h1>
										<div className={styles.speen}>
											<img src={speen} alt="loading..." />
										</div>
									</div>
								);
							case SendState.Sent:
								return (
									<div>
										<h1>Invitation sent!</h1>
										<p>
											The invitation has been sent. If the person accepts, they
											will appear in your friends list.
										</p>
									</div>
								);
							case SendState.Captcha:
								return (
									<div>
										<h1>CAPTCHA Encountered</h1>
										<p>
											Unfortunately, a CAPTCHA was encountered. This is an
											unrecoverable error. Press "Close" to close this window.
										</p>
									</div>
								);
						}
					})()}
				</div>
				{sendState === SendState.Unsent && (
					<div className={styles.form}>
						<label htmlFor="username">Instant messaging username:</label>
						<input
							onChange={(e) => setUsername(e.currentTarget.value)}
							name="username"
							type="text"
							id="username"
						/>
						<div className={styles.example}>Example: notnullptr</div>
						<div className={styles.error}>{error}</div>
					</div>
				)}
			</div>
			<div className={styles.bottomContainer}>
				<div className={styles.divider} />
				<button
					style={{
						display: sendState !== SendState.Unsent ? "none" : undefined,
					}}
					onClick={click}
					disabled={!(name.length > 0)}
				>
					Send Invitation
				</button>
				<button onClick={() => window.close()}>
					{sendState !== SendState.Sent && sendState !== SendState.Captcha
						? "Cancel"
						: "Close"}
				</button>
			</div>
		</div>
	);
}

export default AddFriend;
