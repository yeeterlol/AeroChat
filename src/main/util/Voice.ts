import WebSocket, { WebSocketServer } from "ws";
import dgram from "dgram";
import { exit } from "process";
import _libsodium from "libsodium-wrappers";
import { OpusEncoder } from "@discordjs/opus";
import chalk from "chalk";
import Speaker from "speaker";
import Microphone from "node-microphone";
import { is } from "@electron-toolkit/utils";
import { join } from "path";
import { copyFileSync } from "fs";
import { app } from "electron";
import { WriteStream } from "tty";

class RTPTimeStamp {
	private clockFrequency: number;
	private timestamp: number;

	constructor(clockFrequency: number) {
		this.clockFrequency = clockFrequency;
		this.timestamp = Math.floor(Math.random() * 0xffffffff); // Initial value as random 32-bit number
	}

	public incrementTimestamp(samples: number): void {
		this.timestamp += samples;
	}

	public getCurrentTimestamp(): number {
		return this.timestamp;
	}

	public setCurrentTimestamp(newTimestamp: number): void {
		this.timestamp = newTimestamp;
	}

	public getClockFrequency(): number {
		return this.clockFrequency;
	}
}

if (!is.dev) {
	copyFileSync(
		join(__dirname, "..", "..", "resources", "bin", "sox.exe"),
		app.getPath("temp") + "\\sox.exe",
	);
}

let stream: WriteStream | null;

try {
	stream = new Microphone({
		rate: (48000 / 2) as any, // due to a bug, rate is multiplied by 4. this outputs 192khz which we need to fix later
		bitwidth: 16,
		channels: 1,
		binary: is.dev
			? "resources/bin/sox.exe"
			: app.getPath("temp") + "\\sox.exe",
	}).startRecording();
} catch (e) {
	console.log(e);
}

function log(prefix: string, ...message: any[]) {
	const bracket = chalk.gray("[") + prefix + chalk.gray("]");
	console.log(bracket, ...message);
}

function constructPortScanPacket(ssrc: number, ip: string, port: number) {
	const packetType = Buffer.alloc(2);
	packetType.writeUInt16BE(0x1);

	const packetLength = Buffer.alloc(2);
	packetLength.writeUInt16BE(70);

	const ssrcBuf = Buffer.alloc(4);
	ssrcBuf.writeUInt32BE(ssrc);

	const address = Buffer.alloc(64);
	address.write(ip, 0, "utf-8");

	const portBuffer = Buffer.alloc(2);
	portBuffer.writeUInt16BE(port);

	const packet = Buffer.concat([
		packetType,
		packetLength,
		ssrcBuf,
		address,
		portBuffer,
	]);
	return packet;
}

async function publicIpv4() {
	return await (await fetch("https://icanhazip.com/")).text();
}

export class VoiceConnection {
	voiceGateway: WebSocket | null = null;
	udpSocket: dgram.Socket | null = null;
	server_id: string = "";
	channel_id: string = "";
	interval: NodeJS.Timeout | null = null;
	constructor(
		public token: string,
		public user_id: string,
		public gateway: WebSocket,
	) {}
	async handleVoiceConnection(serverInfo: {
		token: string;
		endpoint: string;
		session_id: string;
	}) {
		await _libsodium.ready;
		const libsodium = _libsodium;
		log(
			chalk.green("Voice Gateway"),
			"Received VOICE_SERVER_UPDATE, initiating connection...",
		);
		let udpInfo: {
			ip: string;
			port: number;
			ssrc: number;
			privateKey: Uint8Array | undefined;
		} | null = null;
		this.udpSocket = dgram.createSocket("udp4");
		const ip = await publicIpv4();
		const { token, endpoint } = serverInfo;
		this.voiceGateway = new WebSocket(`wss://${endpoint}?v=7&encoding=json`);
		this.voiceGateway!.onopen = () => {
			log(chalk.green("Voice Gateway"), "Opened connection!");
			this.voiceGateway!.send(
				JSON.stringify({
					op: 0,
					d: {
						server_id: this.server_id,
						user_id: this.user_id,
						session_id: serverInfo.session_id,
						token,
					},
				}),
			);
		};
		this.voiceGateway!.onmessage = async (m) => {
			const data = JSON.parse(m.data.toString());
			if (data.op === 8) {
				log(chalk.green("Voice Gateway"), "Beginning heartbeat...");
				// interval
				const interval = data.d.heartbeat_interval;

				this.interval = setInterval(() => {
					log(chalk.green("Voice Gateway"), "Heartbeat sent!");
					if (!this.voiceGateway) {
						this.closeVoiceConnection();
						clearInterval(this.interval!);
					}
					this.voiceGateway!.send(
						JSON.stringify({
							op: 3,
							d: null,
						}),
					);
				}, interval);
			}
			if (data.op === 2) {
				// ready yay :333
				log(
					chalk.green("Voice Gateway"),
					"Received READY event, sending op 1 SELECT_PROTOCOL...",
				);
				//
				// voiceGateway.send(
				// 	JSON.stringify({
				// 		op: 1,
				// 		d: {
				// 			protocol: "udp",
				// 			data: {
				// 				address: "",
				// 			},
				// 		},
				// 	})
				// );
				const encoder = new OpusEncoder(48000, 2);
				function decodeVoicePacket(packet: Buffer) {
					// ok so this took way too long to figure out

					// the first byte is the version and flags, which is always 0x80
					// the second byte is the payload type, which is always 0x78
					// the third and fourth bytes are the sequence number, which is always 0x0000 for us
					// the fifth through eighth bytes are the timestamp, which is always 0x00000000 for us
					// the ninth through twelfth bytes are the ssrc, which is always the same for us
					// the rest of the bytes, minus the final 24 bytes, are the encrypted voice data
					// since we're using xsalsa20_poly1305, the nonce is the first 12 bytes of the packet
					const versionAndFlags = packet.readUInt8(0);
					const payloadType = packet.readUInt8(1);
					if (payloadType !== 0x78) return null;
					const sequenceNumber = packet.readUInt16BE(2);
					const timestamp = packet.readUInt32BE(4);
					const ssrc = packet.readUInt32BE(8);
					const audioEncrypted = packet.subarray(12, packet.length);
					let nonce = packet.subarray(0, 12);
					// if its less than 24 bytes, pad it until it is
					if (nonce.length < 24) {
						const padding = Buffer.alloc(24 - nonce.length);
						nonce = Buffer.concat([nonce, padding]);
					}

					try {
						const audioBuf = Buffer.from(
							libsodium.crypto_secretbox_open_easy(
								audioEncrypted,
								nonce,
								udpInfo!.privateKey!,
							),
						);
						const audio = encoder.decode(audioBuf.subarray(8, audioBuf.length));
						return {
							versionAndFlags,
							payloadType,
							sequenceNumber,
							timestamp,
							ssrc,
							audio,
							nonce,
						};
					} catch (err) {
						log(chalk.magenta("Voice UDP"), "Failed to decode audio!", err);
						return null;
					}
				}

				let i = 0;
				let connected = false;
				// let typePcm should be the type of the return type of decodeVoicePacket
				// speaker formatted as 48000hz, 2 channels, 16 bit signed little endian pcm
				let speaker = new Speaker({
					channels: 2,
					bitDepth: 16,
					sampleRate: 48000,
				});
				this.udpSocket!.on("message", (msg) => {
					const decodedPacket = decodeVoicePacket(msg);
					if (decodedPacket) {
						try {
							log(
								chalk.magenta("Voice UDP"),
								"Attempting to play voice packet",
								decodedPacket.sequenceNumber,
								"from ssrc",
								decodedPacket.ssrc,
							);
							speaker.write(decodedPacket.audio);
						} catch (err) {
							log(chalk.magenta("Voice UDP"), "Failed to decode audio packet!");
						}
					} else {
						if (!connected) {
							connected = true;
							const packetType = msg.readUInt16BE(0);
							function getTypeFromPacketType(packetType: number) {
								if (packetType === 0x2) return "port scan response";
								if (packetType === 0x1) return "port scan request";
								if (packetType === 0x80) return "voice packet";
								return "unknown";
							}
							log(
								chalk.magenta("Voice UDP"),
								"(Potentially) connected to voice server!",
								`(reason: 0x${packetType}, ${getTypeFromPacketType(
									packetType,
								)}?)`,
							);
							// const files = fs.readdirSync("./output/bin");
							// for (const file of files) {
							// 	const data = fs.readFileSync(
							// 		`./output/bin/${file}`
							// 	);
							// 	try {
							// 		const decoded = encoder.decode(
							// 			data.subarray(12, data.length)
							// 		);
							// 		fs.writeFileSync(
							// 			`./output/decoded/${file}.pcm`,
							// 			decoded
							// 		);
							// 		log(chalk.cyan("Debug"), "Decoded file:", file);
							// 	} catch {
							// 		log(
							// 			chalk.cyan("Debug"),
							// 			"Failed to decode file:",
							// 			file
							// 		);
							// 	}
							// }
						}
					}
				});
				const speaking = {
					currentIsSpeaking: false,
					prevIsSpeaking: false,
				};
				const timestamp = new RTPTimeStamp(3840);
				setInterval(() => {
					timestamp.incrementTimestamp(3840);
				}, 1000 / 60);
				// as per rfc3550, the sequence number should be a random number to begin with
				let sequenceNumber = Math.floor(Math.random() * 100);
				function convertMonoToStereo(monoDataBuffer: Buffer): Buffer {
					const monoDataLength = monoDataBuffer.length;
					const stereoDataBuffer = Buffer.alloc(monoDataLength * 2);

					for (let i = 0; i < monoDataLength / 2; i++) {
						const sample = monoDataBuffer.readInt16LE(i * 2); // Assuming 16-bit PCM little-endian format
						stereoDataBuffer.writeInt16LE(sample, i * 4); // Left channel
						stereoDataBuffer.writeInt16LE(sample, i * 4 + 2); // Right channel
					}

					return stereoDataBuffer;
				}
				stream?.on("data", async (rawData: Buffer) => {
					if (!this.voiceGateway || !this.udpSocket) return;
					function calculateAverageVolume(pcmData: Buffer) {
						let sum = 0;
						const dataView = new DataView(pcmData.buffer);
						const sampleCount = pcmData.length / 2; // Assuming 16-bit PCM data

						for (let i = 0; i < sampleCount; i++) {
							const sample = dataView.getInt16(i * 2, true); // Assuming little-endian
							sum += Math.abs(sample);
						}

						const averageAmplitude = sum / sampleCount;
						const maxAmplitude = 2048; // Maximum amplitude for 16-bit PCM data

						// Normalize the average amplitude to a range between 0 and 100
						const normalizedVolume = (averageAmplitude / maxAmplitude) * 100;

						return Math.max(0, Math.min(100, normalizedVolume));
					}
					function isSpeaking(buf: Buffer): boolean {
						try {
							const vol = calculateAverageVolume(buf);
							console.log(vol);
							return vol > 15;
						} catch (e) {
							console.log(e);
							return true;
						}
					}
					if (!udpInfo?.privateKey || !udpInfo?.ssrc) return;
					const chunkSize = 3840 * 4;
					const chunks: Buffer[] = [];
					let buf = convertMonoToStereo(rawData);
					for (let i = 0; i < buf.length; i += chunkSize) {
						chunks.push(buf.subarray(i, i + chunkSize));
					}
					const currentlySpeaking = isSpeaking(buf);
					speaking.currentIsSpeaking = currentlySpeaking;
					if (speaking.currentIsSpeaking !== speaking.prevIsSpeaking) {
						log(
							chalk.green("Voice Gateway"),
							`Speaking status changed to ${currentlySpeaking}`,
						);
						this.voiceGateway.send(
							JSON.stringify({
								op: 5,
								d: {
									speaking: currentlySpeaking ? 1 : 0,
									delay: 0,
									ssrc: parseInt(data.d.ssrc),
								},
							}),
						);
					}
					if (buf.length === 0 || chunks.length === 0 || !currentlySpeaking)
						return;
					for await (let chunk of chunks) {
						if (chunk.length < 3840) {
							const padding = Buffer.alloc(3840 - chunk.length);
							chunk = Buffer.concat([chunk, padding]);
						}
						await new Promise((resolve) => setTimeout(resolve, 100));
						let data: Buffer = Buffer.alloc(0);
						try {
							data = encoder.encode(chunk);
						} catch {}
						const vflags = 0x80;
						const payloadType = 0x78;
						const ssrc = udpInfo!.ssrc;
						const header = Buffer.alloc(12);
						header.writeUInt8(vflags, 0);
						header.writeUInt8(payloadType, 1);
						header.writeUInt16BE(sequenceNumber++, 2);
						header.writeUInt32BE(timestamp.getCurrentTimestamp(), 4);
						header.writeUInt32BE(ssrc, 8);
						// encrypt the audio
						// the nonce is the first 12 bytes of the packet, padded to 24 bytes
						let nonce = header;
						if (nonce.length < 24) {
							const padding = Buffer.alloc(24 - nonce.length);
							nonce = Buffer.concat([nonce, padding]);
						}
						const audio = _libsodium.crypto_secretbox_easy(
							data,
							nonce,
							udpInfo!.privateKey!,
						);
						const packet = Buffer.concat([header, audio]);
						if (data.length === 0 || !currentlySpeaking) return;
						log(
							chalk.magenta("Voice UDP"),
							"Sending packet!",
							`(${data.length} bytes)`,
						);
						this.udpSocket.send(packet, udpInfo!.port, udpInfo!.ip);
					}
				});
				const discoverIpAndPort = async () => {
					return new Promise<{
						ip: string;
						port: number;
					}>((resolve, reject) => {
						log(chalk.red("IP Discovery"), "Connecting to UDP port scanner...");
						this.udpSocket!.on("message", (msg, rinfo) => {
							const packetType = msg.readUInt16BE(0);
							if (packetType === 0x2) {
								log(chalk.red("IP Discovery"), "Received port scan response!");
								// get ip, which is 64 bytes long, and starts from the 8th byte
								const ip = msg.toString("utf-8", 8, 72).replaceAll("\x00", "");
								// get port, which is 2 bytes long, an unsigned short and at the end of the packet
								const port = msg.readUInt16BE(msg.length - 2);
								log(
									chalk.red("IP Discovery"),
									`Found ip [redacted] and port ${port}!`,
								);
								resolve({ ip, port });
							}
						});
						this.udpSocket!.on("error", (err) => {
							reject(err);
						});
						this.udpSocket!.send(
							constructPortScanPacket(parseInt(data.d.ssrc), ip, data.d.port),
							data.d.port,
							data.d.ip,
						);
						log(chalk.red("IP Discovery"), "Sent port scan packet!");
					});
				};
				udpInfo = {
					ip: data.d.ip,
					port: data.d.port,
					ssrc: data.d.ssrc,
					privateKey: undefined,
				};
				const networkInfo = await discoverIpAndPort();

				this.voiceGateway!.send(
					JSON.stringify({
						op: 1,
						d: {
							protocol: "udp",
							data: {
								address: networkInfo.ip,
								port: networkInfo.port,
								mode: "xsalsa20_poly1305",
							},
						},
					}),
				);
			}
			if (data.op === 4) {
				// session description, we're ready to connect!
				// first, send a speaking event
				const privateKey = data.d.secret_key as number[];
				// convert to Uint8Array
				const privateKeyUint8 = Uint8Array.from(privateKey);
				udpInfo = {
					...(udpInfo as any),
					privateKey: privateKeyUint8,
				};

				this.voiceGateway!.send(
					JSON.stringify({
						op: 5,
						d: {
							speaking: 0,
							delay: 0,
							ssrc: parseInt(data.d.ssrc),
						},
					}),
				);
			}
		};
	}
	async openVoiceConnection(serverid: string, channelid: string) {
		this.server_id = serverid;
		this.channel_id = channelid;
		let session_id: string | null = null;
		const serverUpdate = (d: WebSocket.RawData): any => {
			const data = JSON.parse(d.toString());
			if (data.t !== "VOICE_SERVER_UPDATE")
				return this.gateway.once("message", serverUpdate);
			this.handleVoiceConnection({ ...data.d, session_id });
		};
		this.gateway.once("message", serverUpdate);
		const stateUpdate = (d: WebSocket.RawData): any => {
			const data = JSON.parse(d.toString());
			if (data.t !== "VOICE_STATE_UPDATE")
				return this.gateway.once("message", stateUpdate);
			if (data.d.user_id !== this.user_id)
				return this.gateway.once("message", stateUpdate);
			session_id = data.d.session_id;
		};
		this.gateway.once("message", stateUpdate);
		this.gateway.send(
			JSON.stringify({
				op: 4,
				d: {
					guild_id: this.server_id,
					channel_id: this.channel_id,
					self_mute: false,
					self_deaf: false,
					self_video: false,
				},
			}),
		);
	}
	async closeVoiceConnection() {
		this.gateway.send(
			JSON.stringify({
				op: 4,
				d: {
					guild_id: null,
					channel_id: null,
					self_mute: false,
					self_deaf: false,
					self_video: false,
				},
			}),
		);
		this.udpSocket?.close();
		this.voiceGateway?.close();
		this.voiceGateway = null;
		this.udpSocket = null;
		clearInterval(this.interval!);
		this.interval = null;
	}
}
