import definePlugin from "@utils/types";
import { findByProps, findComponentByCodeLazy } from "@webpack";
import { React } from "@webpack/common";

let originalVoiceStateUpdate: any;
let fakeDeafenEnabled = false;

const Button = findComponentByCodeLazy(".NONE,disabled:", ".PANEL_BUTTON");

function FakeDeafenIcon() {
    return (
        <svg width="28" height="28" viewBox="0 0 32 32" fill="none">
            {/* Hat (brim + crown) */}
            <rect
                x="6"
                y="8"
                width="20"
                height="4"
                rx="2"
                fill={fakeDeafenEnabled ? "#fff" : "#888"}
            />
            <rect
                x="11"
                y="3"
                width="10"
                height="8"
                rx="3"
                fill={fakeDeafenEnabled ? "#fff" : "#888"}
            />
            {/* Glasses */}
            <circle
                cx="10"
                cy="21"
                r="4"
                stroke={fakeDeafenEnabled ? "#fff" : "#888"}
                strokeWidth="2"
                fill="none"
            />
            <circle
                cx="22"
                cy="21"
                r="4"
                stroke={fakeDeafenEnabled ? "#fff" : "#888"}
                strokeWidth="2"
                fill="none"
            />
            {/* Glasses bridge */}
            <path
                d="M14 21c1 1 3 1 4 0"
                stroke={fakeDeafenEnabled ? "#fff" : "#888"}
                strokeWidth="2"
                strokeLinecap="round"
            />
        </svg>
    );
}

function FakeDeafenButton() {
    return (
        <Button
            tooltipText={fakeDeafenEnabled ? "Disable Fake Deafen" : "Enable Fake Deafen"}
            icon={FakeDeafenIcon}
            role="switch"
            aria-checked={fakeDeafenEnabled}
            redGlow={fakeDeafenEnabled}
            onClick={() => {
                fakeDeafenEnabled = !fakeDeafenEnabled;
                const ChannelStore = findByProps("getChannel", "getDMFromUserId");
                const SelectedChannelStore = findByProps("getVoiceChannelId");
                const GatewayConnection = findByProps("voiceStateUpdate", "voiceServerPing");
                const MediaEngineStore = findByProps("isDeaf", "isMute");
                if (ChannelStore && SelectedChannelStore && GatewayConnection && typeof GatewayConnection.voiceStateUpdate === "function") {
                    const channelId = SelectedChannelStore.getVoiceChannelId?.();
                    const channel = channelId ? ChannelStore.getChannel?.(channelId) : null;
                    if (channel) {
                        if (fakeDeafenEnabled) {
                            GatewayConnection.voiceStateUpdate({
                                channelId: channel.id,
                                guildId: channel.guild_id,
                                selfMute: true,
                                selfDeaf: true
                            });
                        } else {
                            const selfMute = MediaEngineStore?.isMute?.() ?? false;
                            const selfDeaf = MediaEngineStore?.isDeaf?.() ?? false;
                            GatewayConnection.voiceStateUpdate({
                                channelId: channel.id,
                                guildId: channel.guild_id,
                                selfMute,
                                selfDeaf
                            });
                        }
                    }
                }
            }}
        />
    );
}

export default definePlugin({
    name: "FakeDeafen",
    description: "Adds a button to fake deafen yourself in voice channels. When enabled, you appear deafened and muted to others, but you can still hear and speak.",
    authors: [{ name: "hyyven", id: 449282863582412850n }],
    patches: [
        {
            find: "#{intl::ACCOUNT_SPEAKING_WHILE_MUTED}",
            replacement: {
                match: /className:\i\.buttons,.{0,50}children:\[/,
                replace: "$&$self.FakeDeafenButton(),"
            }
        }
    ],
    FakeDeafenButton,
    start() {
        const GatewayConnection = findByProps("voiceStateUpdate", "voiceServerPing");
        if (!GatewayConnection || typeof GatewayConnection.voiceStateUpdate !== "function") {
            console.warn("[FakeDeafen] GatewayConnection.voiceStateUpdate not found");
        } else {
            originalVoiceStateUpdate = GatewayConnection.voiceStateUpdate;
            GatewayConnection.voiceStateUpdate = function (args) {
                if (fakeDeafenEnabled && args && typeof args === "object") {
                    args.selfMute = true;
                    args.selfDeaf = true;
                }
                return originalVoiceStateUpdate.apply(this, arguments);
            };
        }
    },
    stop() {
        const GatewayConnection = findByProps("voiceStateUpdate", "voiceServerPing");
        if (GatewayConnection && originalVoiceStateUpdate) {
            GatewayConnection.voiceStateUpdate = originalVoiceStateUpdate;
        }
    }
});
