import { Logger } from "@utils/Logger";
import definePlugin from "@utils/types";
import { ChannelStore, SelectedChannelStore } from "@webpack/common";

let faking = false;
let origWS: typeof WebSocket.prototype.send;
let gatewaySocket: WebSocket | null = null;
let uiObserver: MutationObserver | null = null;
let lastRenderedFaking: boolean | null = null;

const logger = new Logger("FakeDeafen", "#7b4af7");

function isGatewayUrl(url: string) {
    return /gateway\.discord\.gg/.test(url);
}

function patchedSend(this: WebSocket, data: any) {
    if (isGatewayUrl(this.url)) {
        gatewaySocket = this;

        if (faking && typeof data === "string") {
            try {
                const obj = JSON.parse(data);
                if (obj?.op === 4 && obj?.d) {
                    obj.d.self_mute = true;
                    obj.d.self_deaf = true;
                    return origWS.call(this, JSON.stringify(obj));
                }
            } catch { /* not json — pass through */ }
        }
    }
    return origWS.call(this, data);
}

function sendVoiceUpdate(selfMute: boolean, selfDeaf: boolean) {
    if (!gatewaySocket || gatewaySocket.readyState !== WebSocket.OPEN) {
        logger.warn("Gateway socket not captured yet — try again after Discord sends a heartbeat.");
        return;
    }
    const chanId = SelectedChannelStore.getVoiceChannelId();
    if (!chanId) return;
    const channel = ChannelStore.getChannel(chanId);
    const payload = {
        op: 4,
        d: {
            guild_id: channel?.guild_id ?? null,
            channel_id: chanId,
            self_mute: selfMute,
            self_deaf: selfDeaf
        }
    };
    origWS.call(gatewaySocket, JSON.stringify(payload));
}

function toggleFake() {
    if (!SelectedChannelStore.getVoiceChannelId()) {
        logger.info("Not in a voice channel — toggle ignored.");
        return;
    }
    faking = !faking;
    sendVoiceUpdate(faking, faking);
    updateFdButtonView();
}

export default definePlugin({
    name: "FakeDeafen",
    description: "Fake deafen yourself",
    authors: [{ name: "hyyven", id: 449282863582412850n }, { name: "relony", id: 377696457890988033n }],
    version: "1.2.0",

    start() {
        origWS = WebSocket.prototype.send;
        WebSocket.prototype.send = patchedSend;

        let scheduled = false;
        uiObserver = new MutationObserver(() => {
            if (scheduled) return;
            scheduled = true;
            requestAnimationFrame(() => {
                scheduled = false;
                mountFdButton();
            });
        });
        uiObserver.observe(document.body, { childList: true, subtree: true });
        mountFdButton();

        logger.info("Ready");
    },

    stop() {
        if (faking) {
            faking = false;
            sendVoiceUpdate(false, false);
        }

        WebSocket.prototype.send = origWS;
        gatewaySocket = null;

        uiObserver?.disconnect();
        uiObserver = null;
        document.getElementById("fd-btn")?.remove();

        logger.info("Disarmed");
    }
});

function getIconSvg(active: boolean) {
    const color = active ? "#ed4245" : "currentColor";
    return `
    <svg width="20" height="20" viewBox="0 0 32 32" fill="none">
        <rect x="6" y="8" width="20" height="4" rx="2" fill="${color}"/>
        <rect x="11" y="3" width="10" height="8" rx="3" fill="${color}"/>
        ${active ? `
        <line x1="7" y1="18" x2="13" y2="24" stroke="${color}" stroke-width="2"/>
        <line x1="13" y1="18" x2="7" y2="24" stroke="${color}" stroke-width="2"/>
        <line x1="19" y1="18" x2="25" y2="24" stroke="${color}" stroke-width="2"/>
        <line x1="25" y1="18" x2="19" y2="24" stroke="${color}" stroke-width="2"/>
        <path d="M14 23c1-1 3-1 4 0" stroke="${color}" stroke-width="2" stroke-linecap="round"/>
        ` : `
        <circle cx="10" cy="21" r="4" stroke="${color}" stroke-width="2" fill="none"/>
        <circle cx="22" cy="21" r="4" stroke="${color}" stroke-width="2" fill="none"/>
        <path d="M14 21c1 1 3 1 4 0" stroke="${color}" stroke-width="2" stroke-linecap="round"/>
        `}
    </svg>`;
}

function findDiscordMuteButton(): HTMLElement | null {
    const panels = document.querySelector('[class^="panels_"]');
    if (!panels) return null;
    const buttons = panels.querySelectorAll("button");
    return buttons.length > 0 ? buttons[0] : null;
}

function mountFdButton() {
    if (document.getElementById("fd-btn")) return;

    const muteBtn = findDiscordMuteButton();
    if (!muteBtn) return;

    const fdBtn = document.createElement("button");
    fdBtn.id = "fd-btn";
    fdBtn.className = muteBtn.className;
    fdBtn.setAttribute("aria-label", "Fake Deafen");

    fdBtn.onclick = toggleFake;

    muteBtn.parentElement?.insertBefore(fdBtn, muteBtn);
    lastRenderedFaking = null;
    updateFdButtonView();
}

function updateFdButtonView() {
    const fdBtn = document.getElementById("fd-btn");
    const muteBtn = findDiscordMuteButton();
    if (!fdBtn || !muteBtn) return;
    if (lastRenderedFaking === faking) return;
    const innerClass = muteBtn.querySelector("div")?.className || "";
    fdBtn.innerHTML = `<div class="${innerClass}">${getIconSvg(faking)}</div>`;
    lastRenderedFaking = faking;
}
