import { Relationship } from "detritus-client/lib/structures";
import {
	APIChannel,
	APIConnection,
	APIGuild,
	APIUser,
} from "discord-api-types/v9";
import { GuildMember, PartialUser, Presence } from "discord.js-selfbot-v13";

export interface Session {
	status: string;
	session_id: string;
	client_info: ClientInfo;
	activities: Activity[];
	active?: boolean;
}

export interface Activity {
	type: number;
	state: string;
	name: string;
	id: string;
	emoji?: Emoji;
	created_at: number;
	timestamps?: Timestamps;
	sync_id?: string;
	session_id?: string;
	party?: Party;
	flags?: number;
	details?: string;
	assets?: Assets;
}

export interface Emoji {
	name: string;
}

export interface Party {
	id: string;
}

export interface ClientInfo {
	version: number;
	os: string;
	client: string;
}

export interface MergedPresences {
	guilds: Array<Guild[]>;
	friends: Friend[];
}

export interface Friend {
	user: Partial<APIUser> & { id: string };
	user_id?: string;
	status: Status;
	client_status: ClientStatus;
	activities: FriendActivity[];
}

export interface FriendActivity {
	url?: string;
	type: number;
	state?: string;
	name: string;
	id: string;
	details?: string;
	created_at: number;
	assets?: Assets;
	emoji?: Emoji;
	timestamps?: Timestamps;
	application_id?: string;
	sync_id?: string;
	session_id?: string;
	party?: Party;
	flags?: number;
}

export interface Assets {
	large_image?: string;
	large_text?: string;
	small_text?: string;
	small_image?: string;
}

export interface Emoji {
	name: string;
	id?: string;
	animated?: boolean;
}

export interface Party {
	id: string;
	size?: number[];
}

export interface Timestamps {
	start?: number;
	end?: number;
}

export interface ClientStatus {
	desktop?: Status;
	mobile?: Status;
	embedded?: Status;
	web?: Status;
}

export enum Status {
	DND = "dnd",
	Idle = "idle",
	Offline = "offline",
	Online = "online",
}

export interface Guild {
	user_id: string;
	status: Status;
	client_status: ClientStatus;
	broadcast: null;
	activities: GuildActivity[];
}

export interface GuildActivity {
	type: number;
	state?: string;
	name: string;
	id: string;
	created_at: number;
	emoji?: Emoji;
	timestamps?: Timestamps;
	party?: Party;
	details?: string;
	assets?: Assets;
	application_id?: string;
	sync_id?: string;
	session_id?: string;
	flags?: number;
	buttons?: string[];
}

interface Ready {
	_trace: string[];
	v: number;
	user: APIUser;
	user_settings_proto?: string;
	guilds: APIGuild[];
	relationships: Relationship[];
	friend_suggestion_count?: number;
	private_channels: APIChannel[];
	connected_accounts: APIConnection[];
	notes: Map<string, string>;
	presences: Presence[];
	merged_members: GuildMember[][];
	merged_presences: MergedPresences;
	users: PartialUser[];
	session_id: string;
	session_type: string;
	auth_session_id_hash: string;
	auth_token?: string;
	analytics_token: string;
	required_action?: string;
	country_code: string;
	geo_ordered_rtc_regions: string[];
	shard?: [number, number];
	resume_gateway_url: string;
	api_code_version: number;
	sessions: Session[];
}

export interface State {
	token: string;
	title: string;
	ready: Ready;
}

export interface IContext {
	state: State;
	setState: (newState: State) => void;
}

export enum OpCodes {
	DISPATCH = 0,
	HEARTBEAT = 1,
	IDENTIFY = 2,
	PRESENCE_UPDATE = 3,
	VOICE_STATE_UPDATE = 4,
	VOICE_PING = 5,
	RESUME = 6,
	RECONNECT = 7,
	REQUEST_GUILD_MEMBERS = 8,
	INVALID_SESSION = 9,
	HELLO = 10,
	HEARTBEAT_ACK = 11,
	CALL_CONNECT = 13,
	REGISTER_GUILD_EVENTS = 14,
	LOBBY_CONNECT = 15,
	LOBBY_DISCONNECT = 16,
	LOBBY_VOICE_STATES_UPDATE = 17,
	STREAM_CREATE = 18,
	STREAM_DELETE = 19,
	STREAM_WATCH = 20,
	STREAM_PING = 21,
	STREAM_SET_PAUSED = 22,
	EMBEDDED_ACTIVITY_CREATE = 25,
	EMBEDDED_ACTIVITY_DELETE = 26,
	EMBEDDED_ACTIVITY_UPDATE = 27,
	REQUEST_FORUM_UNREADS = 28,
	REMOTE_COMMAND = 29,
	REQUEST_DELETED_ENTITY_IDS = 30,
	REQUEST_SOUNDBOARD_SOUNDS = 31,
	CLIENT_SPEEDTEST_CREATE = 32,
	CLIENT_SPEEDTEST_DELETE = 33,
}

export enum RelationshipTypes {
	NONE = 0,
	FRIEND = 1,
	BLOCKED = 2,
	PENDING_INCOMING = 3,
	PENDING_OUTGOING = 4,
	IMPLICIT = 5,
}

export enum GatewayIntents {
	UNKNOWN = 0,
	GUILDS = 1 << 0,
	GUILD_MEMBERS = 1 << 1,
	GUILD_MODERATION = 1 << 2,
	GUILD_EMOJIS_AND_STICKERS = 1 << 3,
	GUILD_INTEGRATIONS = 1 << 4,
	GUILD_WEBHOOKS = 1 << 5,
	GUILD_INVITES = 1 << 6,
	GUILD_VOICE_STATES = 1 << 7,
	GUILD_PRESENCES = 1 << 8,
	GUILD_MESSAGES = 1 << 9,
	GUILD_MESSAGE_REACTIONS = 1 << 10,
	GUILD_MESSAGE_TYPING = 1 << 11,
	DIRECT_MESSAGES = 1 << 12,
	DIRECT_MESSAGE_REACTIONS = 1 << 13,
	DIRECT_MESSAGE_TYPING = 1 << 14,
	MESSAGE_CONTENT = 1 << 15,
	GUILD_SCHEDULED_EVENTS = 1 << 16,
	AUTO_MODERATION_CONFIGURATION = 1 << 20,
	AUTO_MODERATION_EXECUTION = 1 << 21,
}

enum GatewayCapabilities {
	LAZY_USER_NOTES = 1 << 0,
	NO_AFFINE_USER_IDS = 1 << 1,
	VERSIONED_READ_STATES = 1 << 2,
	VERSIONED_USER_GUILD_SETTINGS = 1 << 3,
	DEDUPE_USER_OBJECTS = 1 << 4,
	PRIORITIZED_READY_PAYLOAD = 1 << 5,
	MULTIPLE_GUILD_EXPERIMENT_POPULATIONS = 1 << 6,
	NON_CHANNEL_READ_STATES = 1 << 7,
	AUTH_TOKEN_REFRESH = 1 << 8,
	USER_SETTINGS_PROTO = 1 << 9,
	CLIENT_STATE_V2 = 1 << 10,
	PASSIVE_GUILD_UPDATE = 1 << 11,
	UNKNOWN = 1 << 12,
}

export const allCapabilities =
	GatewayCapabilities.LAZY_USER_NOTES |
	GatewayCapabilities.NO_AFFINE_USER_IDS |
	GatewayCapabilities.VERSIONED_READ_STATES |
	GatewayCapabilities.VERSIONED_USER_GUILD_SETTINGS |
	GatewayCapabilities.DEDUPE_USER_OBJECTS |
	GatewayCapabilities.PRIORITIZED_READY_PAYLOAD |
	GatewayCapabilities.MULTIPLE_GUILD_EXPERIMENT_POPULATIONS |
	GatewayCapabilities.NON_CHANNEL_READ_STATES |
	GatewayCapabilities.AUTH_TOKEN_REFRESH |
	GatewayCapabilities.USER_SETTINGS_PROTO |
	GatewayCapabilities.CLIENT_STATE_V2 |
	GatewayCapabilities.PASSIVE_GUILD_UPDATE |
	GatewayCapabilities.UNKNOWN;

export type PopupWindowProps = Electron.BrowserWindowConstructorOptions & {
	customProps: {
		url: string;
		checkForDupes?: boolean;
		alwaysOnTopValue?:
			| "normal"
			| "floating"
			| "torn-off-menu"
			| "modal-panel"
			| "main-menu"
			| "status"
			| "pop-up-menu"
			| "screen-saver";
	};
};

export enum ContextMenuItemType {
	Item = "item",
	Divider = "divider",
}

interface CtxBaseItem {
	type: ContextMenuItemType.Item;
	label: string;
	click?: () => void;
	icon?: string;
}

interface CtxDivider {
	type: ContextMenuItemType.Divider;
}

export type ContextMenuItem = CtxBaseItem | CtxDivider;

export enum ContextMenuStyle {
	Classic = "CLASSIC",
	Modern = "MODERN",
}
