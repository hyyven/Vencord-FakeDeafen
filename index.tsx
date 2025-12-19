import definePlugin from "@utils/types";
import { findByProps } from "@webpack";
import { React } from "@webpack/common";

let originalVoiceStateUpdate: any;
let fakeDeafenEnabled = false;

function FakeDeafenIcon({ enabled }: { enabled: boolean }) {
    const color = enabled ? "#fff" : "#888";
    return (
        <svg width="20" height="20" viewBox="0 0 32 32" fill="none" style={{ width: "20px", height: "20px" }}>
            <rect x="6" y="8" width="20" height="4" rx="2" fill={color} />
            <rect x="11" y="3" width="10" height="8" rx="3" fill={color} />
            <circle cx="10" cy="21" r="4" stroke={color} strokeWidth="2" fill="none" />
            <circle cx="22" cy="21" r="4" stroke={color} strokeWidth="2" fill="none" />
            <path d="M14 21c1 1 3 1 4 0" stroke={color} strokeWidth="2" strokeLinecap="round" />
        </svg>
    );
}

function FakeDeafenButton() {
    const [enabled, setEnabled] = React.useState(fakeDeafenEnabled);

    const handleClick = React.useCallback((e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        
        const newState = !fakeDeafenEnabled;
        fakeDeafenEnabled = newState;
        setEnabled(newState);

        const ChannelStore = findByProps("getChannel", "getDMFromUserId");
        const SelectedChannelStore = findByProps("getVoiceChannelId");
        const GatewayConnection = findByProps("voiceStateUpdate", "voiceServerPing");
        const MediaEngineStore = findByProps("isDeaf", "isMute");

        if (!GatewayConnection || !SelectedChannelStore) return;

        const channelId = SelectedChannelStore.getVoiceChannelId();
        const channel = channelId ? ChannelStore?.getChannel(channelId) : null;
        
        if (channel) {
            GatewayConnection.voiceStateUpdate({
                channelId: channel.id,
                guildId: channel.guild_id,
                selfMute: newState || (MediaEngineStore?.isMute() ?? false),
                selfDeaf: newState || (MediaEngineStore?.isDeaf() ?? false)
            });
        }
    }, []);

    return (
        <button
            aria-label={enabled ? "Disable Fake Deafen" : "Enable Fake Deafen"}
            aria-checked={enabled}
            role="switch"
            type="button"
            className="_67645e1530f1195d-button _37e49614b9f110a9-micButtonWithMenu _67645e1530f1195d-enabled _201d5e8a3c09670a-button _201d5e8a3c09670a-lookBlank _201d5e8a3c09670a-colorBrand _201d5e8a3c09670a-grow"
            onClick={handleClick}
        >
            <div className="_201d5e8a3c09670a-contents">
                <FakeDeafenIcon enabled={enabled} />
            </div>
        </button>
    );
}

export default definePlugin({
    name: "FakeDeafen",
    description: "Fake deafen yourself.",
    authors: [{ name: "hyyven", id: 449282863582412850n }],
    patches: [
        {
            find: "#{intl::ACCOUNT_SPEAKING_WHILE_MUTED}",
            replacement: {
                match: /className:\w+\.buttons,.{0,100}children:\[/,
                replace: "$&$self.FakeDeafenButton(),"
            }
        }
    ],
    FakeDeafenButton,
    start() {
        const GatewayConnection = findByProps("voiceStateUpdate", "voiceServerPing");
        if (!GatewayConnection) return;
        
        originalVoiceStateUpdate = GatewayConnection.voiceStateUpdate;
        GatewayConnection.voiceStateUpdate = function (args: any) {
            if (fakeDeafenEnabled && args && typeof args === "object") {
                args.selfMute = true;
                args.selfDeaf = true;
            }
            return originalVoiceStateUpdate.apply(this, arguments);
        };
    },
    stop() {
        const GatewayConnection = findByProps("voiceStateUpdate", "voiceServerPing");
        if (GatewayConnection && originalVoiceStateUpdate) {
            GatewayConnection.voiceStateUpdate = originalVoiceStateUpdate;
        }
    }
});