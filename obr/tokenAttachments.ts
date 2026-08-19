/**
 * Token Attachment Helpers
 * Creates stat visualizations attached to tokens:
 * - HP Bar (standard progress bar style or stealth HP Dealt mode) - at bottom
 * - Hope, Stress, Armor shapes - on sides
 * - Status badges - at top
 */

import OBR, { buildShape, buildText, Image, Item, isImage } from "@owlbear-rodeo/sdk";
import { DaggerheartVitals, DaggerheartStatuses, OBRStorage } from "./storage";

export const ATTACHMENT_PREFIX = "com.fateweaver.attachment";
export const TRACKER_METADATA_ID = "com.fateweaver.tracker/metadata";

export interface TokenTrackerData {
    hp: number;
    hpMax: number;
    stress?: number;
    armor?: number;
    hope?: number;
    showHp?: boolean; // default true: shows current/max; false: shows HP DEALT only
    hideStats?: boolean; // GM only visibility
    statuses?: DaggerheartStatuses;
}

// Colors matching the fullscreen menu
const STAT_COLORS = {
    hope: { stroke: "#fbbf24" },      // Amber
    stress: { stroke: "#c084fc" },    // Purple  
    armor: { stroke: "#7dd3fc" },     // Sky blue
};

// Status badge colors and abbreviations - matching fullscreen menu (DaggerheartStats.tsx)
const STATUS_BADGES: Record<keyof DaggerheartStatuses, { color: string; bg: string; abbr: string }> = {
    vulnerable: { color: "#f87171", bg: "#450a0a", abbr: "VUL" },
    blinded: { color: "#c084fc", bg: "#3b0764", abbr: "BLN" },
    frightened: { color: "#facc15", bg: "#422006", abbr: "FRT" },
    hidden: { color: "#94a3b8", bg: "#1e293b", abbr: "HID" },
    restrained: { color: "#fb923c", bg: "#431407", abbr: "RST" },
    slowed: { color: "#60a5fa", bg: "#1e3a8a", abbr: "SLW" },
    weakened: { color: "#f472b6", bg: "#831843", abbr: "WKN" },
    empowered: { color: "#34d399", bg: "#064e3b", abbr: "EMP" },
};

interface TokenBounds {
    position: { x: number; y: number };
    width: number;
    height: number;
}

export const getTokenBounds = async (tokenId: string): Promise<TokenBounds | null> => {
    try {
        const bounds = await OBR.scene.items.getItemBounds([tokenId]);
        return {
            position: bounds.min,
            width: bounds.max.x - bounds.min.x,
            height: bounds.max.y - bounds.min.y,
        };
    } catch (e) {
        console.error("Failed to get token bounds:", e);
        return null;
    }
};

export const getToken = async (tokenId: string): Promise<Image | null> => {
    try {
        const items = await OBR.scene.items.getItems([tokenId]);
        return (items[0] as Image) || null;
    } catch (e) {
        console.error("Failed to get token:", e);
        return null;
    }
};

export const getTokenTrackerData = (item: Item): TokenTrackerData | null => {
    if (!item.metadata || !item.metadata[TRACKER_METADATA_ID]) return null;
    return item.metadata[TRACKER_METADATA_ID] as TokenTrackerData;
};

export const setTokenTrackerData = async (tokenId: string, data: Partial<TokenTrackerData>): Promise<void> => {
    try {
        await OBR.scene.items.updateItems([tokenId], (items) => {
            for (const item of items) {
                const existing = (item.metadata[TRACKER_METADATA_ID] as TokenTrackerData) || {
                    hp: 10,
                    hpMax: 10,
                    stress: 0,
                    armor: 0,
                    hope: 0,
                    showHp: true,
                    hideStats: false,
                    statuses: {
                        vulnerable: false,
                        blinded: false,
                        frightened: false,
                        hidden: false,
                        restrained: false,
                        slowed: false,
                        weakened: false,
                        empowered: false,
                    }
                };
                item.metadata[TRACKER_METADATA_ID] = {
                    ...existing,
                    ...data,
                    statuses: {
                        ...(existing.statuses || {}),
                        ...(data.statuses || {}),
                    }
                };
            }
        });

        // Trigger attachment refresh for this token
        const token = await getToken(tokenId);
        if (token) {
            const tracker = getTokenTrackerData(token);
            if (tracker) {
                await updateTokenAttachments(tokenId, tracker, tracker.statuses, tracker.showHp ?? true);
            }
        }
    } catch (e) {
        console.error("Failed to set token tracker data:", e);
    }
};

export const removeTokenTrackerData = async (tokenId: string): Promise<void> => {
    try {
        await OBR.scene.items.updateItems([tokenId], (items) => {
            for (const item of items) {
                delete item.metadata[TRACKER_METADATA_ID];
            }
        });
        await deleteTokenAttachments(tokenId);
    } catch (e) {
        console.error("Failed to remove token tracker data:", e);
    }
};

export const createTokenAttachments = async (
    tokenId: string,
    vitals: DaggerheartVitals | TokenTrackerData,
    statuses?: DaggerheartStatuses,
    showHp: boolean = true
): Promise<void> => {
    const token = await getToken(tokenId);
    const bounds = await getTokenBounds(tokenId);
    if (!token || !bounds) return;

    // Check if vitals object contains showHp or statuses
    const isTrackerData = 'showHp' in vitals;
    const trackerShowHp = isTrackerData && (vitals as TokenTrackerData).showHp !== undefined
        ? (vitals as TokenTrackerData).showHp
        : showHp;
    const trackerStatuses = statuses || (isTrackerData ? (vitals as TokenTrackerData).statuses : undefined);

    const items: Item[] = [];
    const absWidth = Math.abs(bounds.width);
    const absHeight = Math.abs(bounds.height);

    // === DIMENSIONS ===
    const height = Math.abs(Math.ceil(absHeight / 4.85));
    const width = absWidth;
    const border = Math.max(1, Math.floor(width / 75));

    const shapeHeight = Math.abs(absHeight / 2.3);
    const shapeWidth = Math.abs(absWidth / 3);

    const barPosition = {
        x: bounds.width < 0 ? bounds.position.x - width : bounds.position.x,
        y: bounds.position.y + absHeight - height - absHeight / 10,
    };

    if (trackerShowHp) {
        // === 1. STANDARD HP BAR (current / max) ===
        const hpPercentage = vitals.hpMax > 0 ? Math.max(0, Math.min(1, vitals.hp / vitals.hpMax)) : 0;

        const hpBg = buildShape()
            .shapeType("RECTANGLE")
            .width(width)
            .height(height)
            .fillColor("black")
            .fillOpacity(0.65)
            .strokeColor("black")
            .strokeOpacity(0.8)
            .position(barPosition)
            .attachedTo(tokenId)
            .layer(token.layer)
            .locked(true)
            .disableHit(true)
            .disableAttachmentBehavior(["ROTATION"])
            .visible(token.visible)
            .zIndex(token.zIndex + 1)
            .name(`${ATTACHMENT_PREFIX}.hp.bg`)
            .build();

        const fillWidth = hpPercentage > 0 ? (width - border * 2) * hpPercentage : 0;
        const hpFill = buildShape()
            .shapeType("RECTANGLE")
            .width(fillWidth)
            .height(height - border * 2)
            .fillColor("#dc2626") // Crimson Red for HP bar
            .fillOpacity(0.85)
            .strokeWidth(0)
            .strokeOpacity(0)
            .position({ x: barPosition.x + border, y: barPosition.y + border })
            .attachedTo(tokenId)
            .layer(token.layer)
            .locked(true)
            .disableHit(true)
            .disableAttachmentBehavior(["ROTATION"])
            .visible(token.visible)
            .zIndex(token.zIndex + 2)
            .name(`${ATTACHMENT_PREFIX}.hp.fill`)
            .build();

        const overflow = 100;
        const hpText = buildText()
            .textType("PLAIN")
            .width(width + overflow)
            .height(height)
            .position({
                x: bounds.width < 0 ? bounds.position.x + bounds.width - overflow / 2 : bounds.position.x - overflow / 2,
                y: barPosition.y
            })
            .attachedTo(tokenId)
            .layer(token.layer)
            .plainText(`${vitals.hp}/${vitals.hpMax}`)
            .locked(true)
            .textAlign("CENTER")
            .textAlignVertical("MIDDLE")
            .fontWeight(700)
            .fillColor("#ffffff")
            .strokeColor("black")
            .strokeWidth(2)
            .fontSize(Math.max(10, Math.floor(height * 0.7)))
            .lineHeight(1)
            .disableHit(true)
            .disableAttachmentBehavior(["ROTATION"])
            .visible(token.visible)
            .zIndex(token.zIndex + 4)
            .name(`${ATTACHMENT_PREFIX}.hp.text`)
            .build();

        hpBg.metadata[ATTACHMENT_PREFIX] = { type: "hp.bg" };
        hpFill.metadata[ATTACHMENT_PREFIX] = { type: "hp.fill" };
        hpText.metadata[ATTACHMENT_PREFIX] = { type: "hp.text" };
        items.push(hpBg, hpFill, hpText);
    } else {
        // === 2. HP DEALT MODE (Stealth mode for enemies - Only displays damage taken) ===
        const damageDealt = Math.max(0, vitals.hpMax - vitals.hp);

        const dealtBg = buildShape()
            .shapeType("RECTANGLE")
            .width(width)
            .height(height)
            .fillColor("#18181b")
            .fillOpacity(0.85)
            .strokeColor(damageDealt > 0 ? "#ef4444" : "#3f3f46")
            .strokeWidth(border)
            .strokeOpacity(0.9)
            .position(barPosition)
            .attachedTo(tokenId)
            .layer(token.layer)
            .locked(true)
            .disableHit(true)
            .disableAttachmentBehavior(["ROTATION"])
            .visible(token.visible)
            .zIndex(token.zIndex + 1)
            .name(`${ATTACHMENT_PREFIX}.hp.bg`)
            .build();

        const overflow = 100;
        const dealtText = buildText()
            .textType("PLAIN")
            .width(width + overflow)
            .height(height)
            .position({
                x: bounds.width < 0 ? bounds.position.x + bounds.width - overflow / 2 : bounds.position.x - overflow / 2,
                y: barPosition.y
            })
            .attachedTo(tokenId)
            .layer(token.layer)
            .plainText(damageDealt > 0 ? `💥 ${damageDealt} DEALT` : `NO DMG`)
            .locked(true)
            .textAlign("CENTER")
            .textAlignVertical("MIDDLE")
            .fontWeight(700)
            .fillColor(damageDealt > 0 ? "#fca5a5" : "#a1a1aa")
            .strokeColor("black")
            .strokeWidth(2)
            .fontSize(Math.max(10, Math.floor(height * 0.65)))
            .lineHeight(1)
            .disableHit(true)
            .disableAttachmentBehavior(["ROTATION"])
            .visible(token.visible)
            .zIndex(token.zIndex + 4)
            .name(`${ATTACHMENT_PREFIX}.hp.text`)
            .build();

        dealtBg.metadata[ATTACHMENT_PREFIX] = { type: "hp.bg" };
        dealtText.metadata[ATTACHMENT_PREFIX] = { type: "hp.text" };
        items.push(dealtBg, dealtText);
    }

    // === COMMON SIZING ===
    const iconSize = shapeWidth * 0.65;
    const smallGap = iconSize * 0.1;

    // === STRESS HEXAGON (above HP bar, left side) ===
    if (vitals.stress !== undefined && (vitals.stress > 0 || trackerShowHp)) {
        const stressX = barPosition.x;
        const stressY = barPosition.y - iconSize - smallGap;

        const stressShape = buildShape()
            .shapeType("HEXAGON")
            .width(iconSize)
            .height(iconSize)
            .fillColor("black")
            .fillOpacity(0.5)
            .strokeWidth(shapeWidth / 25)
            .strokeColor(STAT_COLORS.stress.stroke)
            .position({ x: stressX + iconSize / 2, y: stressY + iconSize / 2 })
            .attachedTo(tokenId)
            .layer(token.layer)
            .locked(true)
            .disableHit(true)
            .disableAttachmentBehavior(["ROTATION"])
            .visible(token.visible)
            .zIndex(token.zIndex + 2)
            .name(`${ATTACHMENT_PREFIX}.stress.bg`)
            .build();

        const stressText = buildText()
            .textType("PLAIN")
            .width(iconSize)
            .height(iconSize)
            .position({ x: stressX, y: stressY })
            .attachedTo(tokenId)
            .layer(token.layer)
            .plainText(`${vitals.stress}`)
            .locked(true)
            .textAlign("CENTER")
            .textAlignVertical("MIDDLE")
            .fontWeight(600)
            .fillColor("#ffffff")
            .strokeColor("black")
            .strokeWidth(2)
            .fontSize(iconSize * 0.55)
            .lineHeight(1)
            .disableHit(true)
            .disableAttachmentBehavior(["ROTATION"])
            .visible(token.visible)
            .zIndex(token.zIndex + 4)
            .name(`${ATTACHMENT_PREFIX}.stress.text`)
            .build();

        stressShape.metadata[ATTACHMENT_PREFIX] = { type: "stress.bg" };
        stressText.metadata[ATTACHMENT_PREFIX] = { type: "stress.text" };
        items.push(stressShape, stressText);

        // === HOPE CIRCLE (directly above Stress, small margin) ===
        if (vitals.hope !== undefined && (vitals.hope > 0 || trackerShowHp)) {
            const hopeX = stressX;
            const hopeY = stressY - iconSize - smallGap;

            const hopeCircle = buildShape()
                .shapeType("CIRCLE")
                .width(iconSize)
                .height(iconSize)
                .fillColor("black")
                .fillOpacity(0.5)
                .strokeWidth(shapeWidth / 25)
                .strokeColor(STAT_COLORS.hope.stroke)
                .position({ x: hopeX + iconSize / 2, y: hopeY + iconSize / 2 })
                .attachedTo(tokenId)
                .layer(token.layer)
                .locked(true)
                .disableHit(true)
                .disableAttachmentBehavior(["ROTATION"])
                .visible(token.visible)
                .zIndex(token.zIndex + 2)
                .name(`${ATTACHMENT_PREFIX}.hope.bg`)
                .build();

            const hopeText = buildText()
                .textType("PLAIN")
                .width(iconSize)
                .height(iconSize)
                .position({ x: hopeX, y: hopeY })
                .attachedTo(tokenId)
                .layer(token.layer)
                .plainText(`${vitals.hope}`)
                .locked(true)
                .textAlign("CENTER")
                .textAlignVertical("MIDDLE")
                .fontWeight(600)
                .fillColor("#ffffff")
                .strokeColor("black")
                .strokeWidth(2)
                .fontSize(iconSize * 0.55)
                .lineHeight(1)
                .disableHit(true)
                .disableAttachmentBehavior(["ROTATION"])
                .visible(token.visible)
                .zIndex(token.zIndex + 4)
                .name(`${ATTACHMENT_PREFIX}.hope.text`)
                .build();

            hopeCircle.metadata[ATTACHMENT_PREFIX] = { type: "hope.bg" };
            hopeText.metadata[ATTACHMENT_PREFIX] = { type: "hope.text" };
            items.push(hopeCircle, hopeText);
        }
    }

    // === ARMOR CIRCLE (right side) ===
    if (vitals.armor !== undefined && (vitals.armor > 0 || trackerShowHp)) {
        const armorX = bounds.position.x + (bounds.width < 0 ? 0 : absWidth) - iconSize;
        const armorY = barPosition.y - iconSize - smallGap;

        const armorCircle = buildShape()
            .shapeType("CIRCLE")
            .width(iconSize)
            .height(iconSize)
            .fillColor("black")
            .fillOpacity(0.5)
            .strokeWidth(shapeWidth / 25)
            .strokeColor(STAT_COLORS.armor.stroke)
            .position({ x: armorX + iconSize / 2, y: armorY + iconSize / 2 })
            .attachedTo(tokenId)
            .layer(token.layer)
            .locked(true)
            .disableHit(true)
            .disableAttachmentBehavior(["ROTATION"])
            .visible(token.visible)
            .zIndex(token.zIndex + 2)
            .name(`${ATTACHMENT_PREFIX}.armor.bg`)
            .build();

        const armorText = buildText()
            .textType("PLAIN")
            .width(iconSize)
            .height(iconSize)
            .position({ x: armorX, y: armorY })
            .attachedTo(tokenId)
            .layer(token.layer)
            .plainText(`${vitals.armor}`)
            .locked(true)
            .textAlign("CENTER")
            .textAlignVertical("MIDDLE")
            .fontWeight(600)
            .fillColor("#ffffff")
            .strokeColor("black")
            .strokeWidth(2)
            .fontSize(iconSize * 0.55)
            .lineHeight(1)
            .disableHit(true)
            .disableAttachmentBehavior(["ROTATION"])
            .visible(token.visible)
            .zIndex(token.zIndex + 4)
            .name(`${ATTACHMENT_PREFIX}.armor.text`)
            .build();

        armorCircle.metadata[ATTACHMENT_PREFIX] = { type: "armor.bg" };
        armorText.metadata[ATTACHMENT_PREFIX] = { type: "armor.text" };
        items.push(armorCircle, armorText);
    }

    // === STATUS BADGES ===
    if (trackerStatuses) {
        const activeStatuses = Object.entries(trackerStatuses)
            .filter(([_, active]) => active)
            .map(([key]) => key as keyof DaggerheartStatuses);

        if (activeStatuses.length > 0) {
            const badgeSize = absWidth / 6;
            const badgeSpacing = badgeSize * 1.15;
            const totalWidth = activeStatuses.length * badgeSpacing - (badgeSpacing - badgeSize);
            const startX = bounds.position.x + (absWidth - totalWidth) / 2;
            const badgeY = bounds.position.y - badgeSize * 1.3;

            for (let i = 0; i < activeStatuses.length; i++) {
                const statusKey = activeStatuses[i];
                const statusInfo = STATUS_BADGES[statusKey];
                const badgeX = startX + (badgeSpacing * i);

                const badge = buildShape()
                    .shapeType("CIRCLE")
                    .width(badgeSize)
                    .height(badgeSize)
                    .fillColor(statusInfo.bg)
                    .fillOpacity(0.8)
                    .strokeColor(statusInfo.color)
                    .strokeWidth(Math.max(2, badgeSize / 15))
                    .position({ x: badgeX + badgeSize / 2, y: badgeY + badgeSize / 2 })
                    .attachedTo(tokenId)
                    .layer(token.layer)
                    .locked(true)
                    .disableHit(true)
                    .disableAttachmentBehavior(["ROTATION"])
                    .visible(token.visible)
                    .zIndex(token.zIndex + 5)
                    .name(`${ATTACHMENT_PREFIX}.status.${statusKey}.bg`)
                    .build();

                const badgeText = buildText()
                    .textType("PLAIN")
                    .width(badgeSize)
                    .height(badgeSize)
                    .position({ x: badgeX, y: badgeY })
                    .attachedTo(tokenId)
                    .layer(token.layer)
                    .plainText(statusInfo.abbr)
                    .locked(true)
                    .textAlign("CENTER")
                    .textAlignVertical("MIDDLE")
                    .fontWeight(700)
                    .fillColor(statusInfo.color)
                    .strokeColor("#000000")
                    .strokeWidth(1)
                    .fontSize(badgeSize * 0.35)
                    .lineHeight(1)
                    .disableHit(true)
                    .disableAttachmentBehavior(["ROTATION"])
                    .visible(token.visible)
                    .zIndex(token.zIndex + 6)
                    .name(`${ATTACHMENT_PREFIX}.status.${statusKey}.text`)
                    .build();

                badge.metadata[ATTACHMENT_PREFIX] = { type: `status.${statusKey}.bg` };
                badgeText.metadata[ATTACHMENT_PREFIX] = { type: `status.${statusKey}.text` };
                items.push(badge, badgeText);
            }
        }
    }

    try {
        await OBR.scene.items.addItems(items);
    } catch (e) {
        console.error("Failed to add token attachments:", e);
    }
};

export const updateTokenAttachments = async (
    tokenId: string,
    vitals: DaggerheartVitals | TokenTrackerData,
    statuses?: DaggerheartStatuses,
    showHp: boolean = true
): Promise<void> => {
    try {
        const attachments = await OBR.scene.items.getItemAttachments([tokenId]);
        const ourAttachments = attachments.filter(item =>
            item.name?.startsWith(ATTACHMENT_PREFIX)
        );

        if (ourAttachments.length > 0) {
            await OBR.scene.items.deleteItems(ourAttachments.map(a => a.id));
        }
        await createTokenAttachments(tokenId, vitals, statuses, showHp);
    } catch (e) {
        console.error("Failed to update token attachments:", e);
    }
};

export const deleteTokenAttachments = async (tokenId: string): Promise<void> => {
    try {
        const attachments = await OBR.scene.items.getItemAttachments([tokenId]);
        const ourAttachments = attachments.filter(item =>
            item.name?.startsWith(ATTACHMENT_PREFIX)
        );

        if (ourAttachments.length > 0) {
            await OBR.scene.items.deleteItems(ourAttachments.map(a => a.id));
        }
    } catch (e) {
        console.error("Failed to delete token attachments:", e);
    }
};

/**
 * Synchronizes all token attachments on the active scene.
 * Updates attachments for tokens with tracker metadata, and ensures player's selected token is rendered.
 */
export const syncAllSceneTokenAttachments = async (): Promise<void> => {
    try {
        const isReady = await OBR.scene.isReady();
        if (!isReady) return;

        const characterTokens = await OBR.scene.items.getItems(
            (item) => (item.layer === "CHARACTER" || item.layer === "MOUNT") && isImage(item)
        );

        const playerSelectedTokenId = await OBRStorage.getSelectedTokenId();
        const playerVitals = await OBRStorage.getDaggerheartVitals();
        const playerStatuses = await OBRStorage.getDaggerheartStatuses();

        for (const item of characterTokens) {
            const trackerData = getTokenTrackerData(item);
            if (trackerData) {
                await updateTokenAttachments(
                    item.id,
                    trackerData,
                    trackerData.statuses,
                    trackerData.showHp ?? true
                );
            } else if (item.id === playerSelectedTokenId && playerVitals) {
                await updateTokenAttachments(
                    item.id,
                    playerVitals,
                    playerStatuses,
                    true
                );
            }
        }
    } catch (e) {
        console.error("Failed to sync scene token attachments:", e);
    }
};

export const TokenAttachments = {
    create: createTokenAttachments,
    update: updateTokenAttachments,
    delete: deleteTokenAttachments,
    syncAll: syncAllSceneTokenAttachments,
    getTracker: getTokenTrackerData,
    setTracker: setTokenTrackerData,
    removeTracker: removeTokenTrackerData,
};
