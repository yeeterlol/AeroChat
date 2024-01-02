import {
	APIChannel,
	APIGuild,
	APITextChannel,
	APIUser,
	PermissionFlagsBits,
} from "discord-api-types/v9";
import {
	IGuild,
	MergedMember,
	IRole,
	State,
	PermissionOverwrite,
} from "../../../shared/types";
import { getState } from "@renderer/util/ipc";
const remote = window.require(
	"@electron/remote",
) as typeof import("@electron/remote");
const path = window.require("path") as typeof import("path");
const fs = window.require("fs") as typeof import("fs");
const toIco = window.require("to-ico") as typeof import("to-ico");

export class DiscordUtil {
	static state: State = getState();
	static updateState(state: State) {
		this.state = state;
	}
	static getMembership(guild: IGuild) {
		return this.state.ready?.merged_members
			.flat()
			?.find((m) => m.joined_at === guild.joined_at);
	}
	static getChannelById(id: string) {
		return this.state.ready?.guilds
			?.map((g) => g.channels)
			.flat()
			.find((c) => c.id === id);
	}
	static getRoleById(id: string) {
		return this.state.ready?.guilds
			?.map((g) => g.roles)
			.flat()
			.find((r) => r.id === id);
	}
	static getGuildByChannelId(id: string) {
		return this.state.ready?.guilds.find((g) =>
			g.channels.some((c) => c.id === id),
		);
	}
	static getDateById(id?: string | null): number | undefined {
		return id ? Number(BigInt(id) >> 22n) + 1420070400000 : undefined;
	}
	static getUserById(id: string) {
		return this.state?.ready?.users.find((u) => u.id === id);
	}
	static getGuildById(id: string) {
		return this.state?.ready?.guilds.find((g) => g.id === id);
	}
	static async getAvatarPath(user: APIUser | APIGuild | undefined) {
		if (!user) return;
		const url =
			("avatar" in user
				? user.avatar
					? `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png`
					: `https://cdn.discordapp.com/embed/avatars/${
							Number(user.discriminator) % 5
					  }.png`
				: `https://cdn.discordapp.com/icons/${user.id}/${user.icon}.png`) +
			"?size=16";
		const temp = remote.app.getPath("temp");
		const avatarPath = path.join(temp, `avatar-${user.id}.ico`);
		const data = await fetch(url);
		const canvas = new OffscreenCanvas(16, 16);
		const ctx = canvas.getContext("2d");
		if (!ctx) return;
		const img = await createImageBitmap(await data.blob());
		ctx.drawImage(img, 0, 0, 16, 16);
		ctx.strokeStyle = "rgba(0, 0, 0, 0.5)";
		ctx.lineWidth = 2;
		ctx.beginPath();
		ctx.moveTo(0, 0);
		ctx.lineTo(16, 0);
		ctx.lineTo(16, 16);
		ctx.lineTo(0, 16);
		ctx.lineTo(0, 0);
		ctx.stroke();
		ctx.clip();

		const buffer = await toIco(
			Buffer.from(await (await canvas.convertToBlob()).arrayBuffer()),
		);
		fs.writeFileSync(avatarPath, buffer);
		return avatarPath;
	}
}

export class Member {
	properties: MergedMember;
	constructor(member: MergedMember) {
		this.properties = member;
		this.userId = member.user_id;
	}
	userId: string;
}

export class Role {
	properties: IRole;
	constructor(role: IRole) {
		this.properties = role;
	}
}

export class Guild {
	properties: IGuild;
	constructor(guild: IGuild) {
		this.properties = guild;
	}
	isOwner(member: Member) {
		return member.properties.user_id === this.properties.properties.owner_id;
	}
	getRole(id: string) {
		const role = this.properties.roles.find((r) => r.id === id);
		if (role) return new Role(role);
		else return;
	}
}

export class PermissionOverwrites {
	overwrites: PermissionOverwrite[];
	constructor(overwrites: PermissionOverwrite[]) {
		this.overwrites = overwrites;
	}
	get(id: string) {
		const found = this.overwrites.find((o) => o.id === id);
		if (!found) return;
		return {
			allow: BigInt(found.allow),
			deny: BigInt(found.deny),
			id: found.id,
			type: found.type,
		};
	}
}

export class Channel<T extends APIChannel = APITextChannel> {
	properties: T;
	constructor(channel: T) {
		this.properties = channel;
		this.permissionOverwrites = new PermissionOverwrites(
			(channel as any).permission_overwrites || [],
		);
	}
	permissionOverwrites: PermissionOverwrites;
	get guild() {
		return new Guild(DiscordUtil.getGuildByChannelId(this.properties.id)!);
	}
}

export function hasPermission(
	permissions: bigint,
	permission: bigint,
): boolean {
	if (permissions & PermissionFlagsBits.Administrator) return true;
	return (permissions & permission) === permission;
}

function computeBasePermissions(member: Member, guild: Guild) {
	if (guild.isOwner(member)) {
		return PermissionFlagsBits.Administrator;
	}

	let roleEveryone = guild.getRole(guild.properties.id); // get @everyone role
	let permissions = BigInt(roleEveryone!.properties.permissions);

	member.properties.roles.forEach((roleId) => {
		const role = guild.getRole(roleId);
		if (!role) throw new Error("wtf???");
		permissions |= BigInt(role.properties.permissions);
	});

	if (
		(permissions & PermissionFlagsBits.Administrator) ===
		PermissionFlagsBits.Administrator
	) {
		return PermissionFlagsBits.Administrator;
	}

	return permissions;
}

export function convertPermsToArray(perms: bigint) {
	const arr: string[] = [];
	for (const [key, value] of Object.entries(PermissionFlagsBits)) {
		if (BigInt(perms) & BigInt(value)) {
			arr.push(key);
		}
	}
	return arr;
}

function computeOverwrites(
	basePermissions: bigint,
	member: Member,
	channel: Channel,
) {
	if (
		(basePermissions & PermissionFlagsBits.Administrator) ===
		PermissionFlagsBits.Administrator
	) {
		return PermissionFlagsBits.Administrator;
	}

	let permissions = basePermissions;
	let overwriteEveryone = channel.permissionOverwrites.get(
		channel.guild.properties.id,
	);
	if (overwriteEveryone) {
		permissions &= ~overwriteEveryone.deny;
		permissions |= overwriteEveryone.allow;
	}

	let overwrites = channel.permissionOverwrites;
	let allow = 0n;
	let deny = 0n;
	member.properties.roles.forEach((roleId) => {
		let overwriteRole = overwrites.get(roleId);
		if (overwriteRole) {
			allow |= overwriteRole.allow;
			deny |= overwriteRole.deny;
		}
	});

	permissions &= ~deny;
	permissions |= allow;

	let overwriteMember = overwrites.get(member.userId);
	if (overwriteMember) {
		permissions &= ~overwriteMember.deny;
		permissions |= overwriteMember.allow;
	}

	return permissions;
}

export function computePermissions(member: Member, channel: Channel) {
	let basePermissions = computeBasePermissions(member, channel.guild);
	return computeOverwrites(basePermissions, member, channel);
}
