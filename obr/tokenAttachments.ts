/**
 * Token Attachment Helpers
 * Creates stat visualizations attached to tokens:
 * - HP Bar (progress bar style) - at bottom
 * - Hope, Stress, Armor circles - on sides like gm-daggerheart
 * - Status icons - at top
 */

import OBR, { buildShape, buildText, Image, Item } from "@owlbear-rodeo/sdk";
import { DaggerheartVitals, DaggerheartStatuses } from "./storage";

const ATTACHMENT_PREFIX = "com.fateweaver.attachment";

// Colors matching the fullscreen menu
const STAT_COLORS = {
    hope: { fill: "#000000", stroke: "#fbbf24" },      // Amber
    stress: { fill: "#000000", stroke: "#c084fc" },    // Purple
    armor: { fill: "#000000", stroke: "#7dd3fc" },     // Sky blue
    hp: { fill: "#000000", stroke: "#fca5a5", bar: "#dc2626" }, // Red
};

// Status badge colors and abbreviations
const STATUS_BADGES: Record<keyof DaggerheartStatuses, { color: string; bg: string; abbr: string }> = {
    vulnerable: { color: "#fca5a5", bg: "#450a0a", abbr: "VUL" },
    blinded: { color: "#a1a1aa", bg: "#27272a", abbr: "BLN" },
    frightened: { color: "#c084fc", bg: "#3b0764", abbr: "FRT" },
    hidden: { color: "#86efac", bg: "#052e16", abbr: "HID" },
    restrained: { color: "#fcd34d", bg: "#451a03", abbr: "RST" },
    slowed: { color: "#7dd3fc", bg: "#0c4a6e", abbr: "SLW" },
    weakened: { color: "#fb923c", bg: "#431407", abbr: "WKN" },
    empowered: { color: "#facc15", bg: "#422006", abbr: "EMP" },
};

interface TokenBounds {
    position: { x: number; y: number };
    width: number;
    height: number;
}

const getTokenBounds = async (tokenId: string): Promise<TokenBounds | null> => {
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

const getToken = async (tokenId: string): Promise<Image | null> => {
    try {
        const items = await OBR.scene.items.getItems([tokenId]);
        return items[0] as Image || null;
    } catch (e) {
        console.error("Failed to get token:", e);
        return null;
    }
};

export const createTokenAttachments = async (
    tokenId: string,
    vitals: DaggerheartVitals,
    statuses?: DaggerheartStatuses
): Promise<void> => {
    const token = await getToken(tokenId);
    const bounds = await getTokenBounds(tokenId);
    if (!token || !bounds) return;

    const items: Item[] = [];
    const absWidth = Math.abs(bounds.width);
    const absHeight = Math.abs(bounds.height);

    // === HP BAR (like gm-daggerheart: height/4.85, positioned at bottom with height/10 offset) ===
    const barHeight = Math.abs(absHeight / 4);
    const barWidth = absWidth;
    const border = Math.floor(absWidth / 100); // Thinner border
    const hpPercentage = vitals.hpMax > 0 ? vitals.hp / vitals.hpMax : 0;

    const barPosition = {
        x: bounds.position.x,
        y: bounds.position.y + absHeight - barHeight - absHeight / 10,
    };

    // HP Bar Background
    const hpBg = buildShape()
        .shapeType("RECTANGLE")
        .width(barWidth)
        .height(barHeight)
        .fillColor("#000000")
        .fillOpacity(0.5)
        .strokeColor(STAT_COLORS.hp.stroke)
        .strokeWidth(border)
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

    // HP Bar Fill
    const fillWidth = hpPercentage > 0 ? (barWidth - border * 2) * hpPercentage : 0;
    const hpFill = buildShape()
        .shapeType("RECTANGLE")
        .width(fillWidth)
        .height(barHeight - border * 2)
        .fillColor(STAT_COLORS.hp.bar)
        .fillOpacity(0.6)
        .strokeWidth(0)
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

    // HP Text (like gm-daggerheart: centered, fontWeight 600, strokeWidth 2)
    const hpText = buildText()
        .textType("PLAIN")
        .width(barWidth + 100)
        .height(barHeight)
        .position({ x: barPosition.x - 50, y: barPosition.y })
        .attachedTo(tokenId)
        .layer(token.layer)
        .plainText(`${vitals.hp}/${vitals.hpMax}`)
        .locked(true)
        .textAlign("CENTER")
        .textAlignVertical("MIDDLE")
        .fontWeight(600)
        .fillColor("#ffffff")
        .strokeColor("#000000")
        .strokeWidth(2)
        .fontSize(barHeight * 0.7)
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

    // === STAT CIRCLES (positioned on sides like gm-daggerheart) ===
    const shapeHeight = absHeight / 2.3;
    const shapeWidth = absWidth / 3;
    const circleSize = shapeWidth * 0.7;
    const fontSize = barHeight - 3;

    // Left side: Hope (top-left) and Stress (bottom-left)
    // Hope - top left
    const hopeX = bounds.position.x;
    const hopeY = barPosition.y - shapeHeight - absHeight / 20;

    const hopeCircle = buildShape()
        .shapeType("CIRCLE")
        .width(circleSize)
        .height(circleSize)
        .fillColor(STAT_COLORS.hope.fill)
        .fillOpacity(0.5)
        .strokeColor(STAT_COLORS.hope.stroke)
        .strokeWidth(shapeWidth / 25)
        .position({ x: hopeX, y: hopeY })
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
        .width(circleSize)
        .height(circleSize)
        .position({ x: hopeX, y: hopeY })
        .attachedTo(tokenId)
        .layer(token.layer)
        .plainText(`${vitals.hope}`)
        .locked(true)
        .textAlign("CENTER")
        .textAlignVertical("MIDDLE")
        .fontWeight(600)
        .fillColor("#ffffff")
        .strokeColor("#000000")
        .strokeWidth(2)
        .fontSize(fontSize)
        .lineHeight(1)
        .disableHit(true)
        .disableAttachmentBehavior(["ROTATION"])
        .visible(token.visible)
        .zIndex(token.zIndex + 4)
        .name(`${ATTACHMENT_PREFIX}.hope.text`)
        .build();

    // Stress - left side, below hope
    const stressX = bounds.position.x + shapeWidth * 0.34;
    const stressY = barPosition.y - shapeHeight * 0.4;

    const stressCircle = buildShape()
        .shapeType("HEXAGON")
        .width(circleSize)
        .height(circleSize)
        .fillColor(STAT_COLORS.stress.fill)
        .fillOpacity(0.5)
        .strokeColor(STAT_COLORS.stress.stroke)
        .strokeWidth(shapeWidth / 25)
        .position({ x: stressX, y: stressY })
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
        .width(circleSize)
        .height(circleSize)
        .position({ x: stressX, y: stressY })
        .attachedTo(tokenId)
        .layer(token.layer)
        .plainText(`${vitals.stress}`)
        .locked(true)
        .textAlign("CENTER")
        .textAlignVertical("MIDDLE")
        .fontWeight(600)
        .fillColor("#ffffff")
        .strokeColor("#000000")
        .strokeWidth(2)
        .fontSize(fontSize)
        .lineHeight(1)
        .disableHit(true)
        .disableAttachmentBehavior(["ROTATION"])
        .visible(token.visible)
        .zIndex(token.zIndex + 4)
        .name(`${ATTACHMENT_PREFIX}.stress.text`)
        .build();

    // Armor - right side
    const armorX = bounds.position.x + absWidth - circleSize;
    const armorY = barPosition.y - shapeHeight - absHeight / 20;

    const armorCircle = buildShape()
        .shapeType("CIRCLE")
        .width(circleSize)
        .height(circleSize)
        .fillColor(STAT_COLORS.armor.fill)
        .fillOpacity(0.5)
        .strokeColor(STAT_COLORS.armor.stroke)
        .strokeWidth(shapeWidth / 25)
        .position({ x: armorX, y: armorY })
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
        .width(circleSize)
        .height(circleSize)
        .position({ x: armorX, y: armorY })
        .attachedTo(tokenId)
        .layer(token.layer)
        .plainText(`${vitals.armor}`)
        .locked(true)
        .textAlign("CENTER")
        .textAlignVertical("MIDDLE")
        .fontWeight(600)
        .fillColor("#ffffff")
        .strokeColor("#000000")
        .strokeWidth(2)
        .fontSize(fontSize)
        .lineHeight(1)
        .disableHit(true)
        .disableAttachmentBehavior(["ROTATION"])
        .visible(token.visible)
        .zIndex(token.zIndex + 4)
        .name(`${ATTACHMENT_PREFIX}.armor.text`)
        .build();

    hopeCircle.metadata[ATTACHMENT_PREFIX] = { type: "hope.bg" };
    hopeText.metadata[ATTACHMENT_PREFIX] = { type: "hope.text" };
    stressCircle.metadata[ATTACHMENT_PREFIX] = { type: "stress.bg" };
    stressText.metadata[ATTACHMENT_PREFIX] = { type: "stress.text" };
    armorCircle.metadata[ATTACHMENT_PREFIX] = { type: "armor.bg" };
    armorText.metadata[ATTACHMENT_PREFIX] = { type: "armor.text" };

    items.push(hopeCircle, hopeText, stressCircle, stressText, armorCircle, armorText);

    // === STATUS ICONS (at top of token) ===
    if (statuses) {
        const activeStatuses = Object.entries(statuses)
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

                // Badge background
                const badge = buildShape()
                    .shapeType("CIRCLE")
                    .width(badgeSize)
                    .height(badgeSize)
                    .fillColor(statusInfo.bg)
                    .fillOpacity(0.8)
                    .strokeColor(statusInfo.color)
                    .strokeWidth(Math.max(2, badgeSize / 15))
                    .position({ x: badgeX, y: badgeY })
                    .attachedTo(tokenId)
                    .layer(token.layer)
                    .locked(true)
                    .disableHit(true)
                    .disableAttachmentBehavior(["ROTATION"])
                    .visible(token.visible)
                    .zIndex(token.zIndex + 5)
                    .name(`${ATTACHMENT_PREFIX}.status.${statusKey}.bg`)
                    .build();

                // Badge text (abbreviation)
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
                    .fontSize(badgeSize * 0.5)
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
    vitals: DaggerheartVitals,
    statuses?: DaggerheartStatuses
): Promise<void> => {
    try {
        const attachments = await OBR.scene.items.getItemAttachments([tokenId]);
        const ourAttachments = attachments.filter(item =>
            item.name?.startsWith(ATTACHMENT_PREFIX)
        );

        if (ourAttachments.length === 0) {
            await createTokenAttachments(tokenId, vitals, statuses);
            return;
        }

        // Delete and recreate for simplicity (handles status changes)
        await deleteTokenAttachments(tokenId);
        await createTokenAttachments(tokenId, vitals, statuses);
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

export const TokenAttachments = {
    create: createTokenAttachments,
    update: updateTokenAttachments,
    delete: deleteTokenAttachments,
};
