import styles from "@renderer/css/components/Username.module.css";
import { Effect } from "@renderer/util";
import { useEffect, useRef } from "react";

export default function Username({
	username,
	effect,
	color,
	fontSize = 11,
}: {
	username: string;
	effect: Effect;
	color: string;
	fontSize?: number;
}) {
	const canvasRef = useRef<HTMLCanvasElement>(null);
	const requestRef = useRef<number>();
	useEffect(() => {
		const canvas = canvasRef.current!;
		const ctx = canvas.getContext("2d")!;
		type RGB = [number, number, number];

		function lerpRGB(t: number, ...colors: RGB[]): RGB {
			if (t < 0 || t > 1) {
				throw new Error("Parameter t must be between 0 and 1");
			}

			if (colors.length < 2) {
				throw new Error("At least two RGB values are required");
			}

			const segments = colors.length - 1;
			const segmentIndex = Math.floor(t * segments);
			const segmentT = t * segments - segmentIndex;

			const startColor = colors[segmentIndex];
			const endColor = colors[segmentIndex + 1];

			const lerpedColor: RGB = startColor.map((channel, i) => {
				const channelDiff = endColor[i] - channel;
				return channel + channelDiff * segmentT;
			}) as RGB;

			return lerpedColor;
		}

		type EffectFunction = (time: number) => void;
		const effects: Record<Effect, EffectFunction> = {
			[Effect.None]: () => {
				if (!ctx) return;
				ctx.fillText(username, 0, fontSize);
			},
			[Effect.Wave]: (time) => {
				if (!ctx) return;
				for (let i = 0; i < username.length; i++) {
					const char = username[i];
					const offsetLeft = ctx.measureText(username.slice(0, i)).width;
					const offsetTop = Math.sin(time / 150 + i) * 2;
					ctx.fillText(char, offsetLeft, offsetTop + fontSize - 2);
				}
			},
			[Effect.SquashStretch]: (time) => {
				if (!ctx) return;
				// stretch the text
				ctx.textAlign = "center";
				const stretch = Math.sin(time / 250) / 16 - 0.12;
				// the stretch on Y should be delayed
				const stretchY = Math.sin((time + 1000) / 250) / 5 - 0.12;
				ctx.save();
				ctx.translate(canvas.width / 2, canvas.height / 2);
				ctx.scale(1 + stretch, 1 + stretchY);
				ctx.translate(-canvas.width / 2, -canvas.height / 2);
				ctx.fillText(username, canvas.width / 2, fontSize);
				ctx.restore();
			},
			[Effect.Rainbow]: (time) => {
				if (!ctx) return;
				ctx.fillText(username, 0, fontSize);
				const gradient = ctx.createLinearGradient(0, 0, canvas.width, 0);
				const correctedTime = time / 4000;
				gradient.addColorStop((correctedTime + 0) % 1, "#8c0900");
				gradient.addColorStop((correctedTime + 1 / 6) % 1, "#b3702e");
				gradient.addColorStop((correctedTime + 2 / 6) % 1, "#778001");
				gradient.addColorStop((correctedTime + 3 / 6) % 1, "#539456");
				gradient.addColorStop((correctedTime + 4 / 6) % 1, "#0f87a8");
				gradient.addColorStop((correctedTime + 5 / 6) % 1, "#6c4f9f");
				gradient.addColorStop((correctedTime + 6 / 6) % 1, "#8c0900");
				ctx.globalCompositeOperation = "source-in";
				ctx.fillStyle = gradient;
				ctx.fillRect(0, 0, canvas.width, canvas.height);
			},
			[Effect.Chrome]: (time) => {
				if (!ctx) return;
				const frame = (time / 3250) % 1;
				const colors: RGB[] = [
					[140, 9, 0],
					[179, 112, 46],
					[119, 128, 1],
					[83, 148, 86],
					[15, 135, 168],
					[108, 79, 159],
					[140, 9, 0],
				];
				const color = lerpRGB(frame, ...colors);
				ctx.fillStyle = `rgb(${color[0]}, ${color[1]}, ${color[2]})`;
				ctx.fillText(username, 0, fontSize);
			},
		};
		async function draw(time: number) {
			if (!ctx) return;
			ctx.font = `${fontSize}px Segoe UI`;
			const measure = ctx.measureText(username);
			canvas.width = measure.width;
			canvas.height = fontSize + 6;
			ctx.font = `${fontSize}px Segoe UI`;

			ctx.fillStyle = "transparent";
			ctx.fillRect(0, 0, canvas.width, canvas.height);
			ctx.fillStyle = color;
			effects[effect](time);
			requestAnimationFrame(async (t) => draw(t));
		}

		requestRef.current = requestAnimationFrame(draw);
		return () => cancelAnimationFrame(requestRef.current!);
	}, [username, fontSize, effect, color]);

	return <canvas ref={canvasRef} className={styles.canvas} />;
}
