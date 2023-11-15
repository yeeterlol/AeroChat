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

export interface Assets {
	large_text: string;
	large_image: string;
}

export interface Emoji {
	name: string;
}

export interface Party {
	id: string;
}

export interface Timestamps {
	start: number;
	end: number;
}

export interface ClientInfo {
	version: number;
	os: string;
	client: string;
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
