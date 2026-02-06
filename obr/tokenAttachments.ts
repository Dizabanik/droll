/**
 * Token Attachment Helpers
 * Creates stat visualizations attached to tokens:
 * - HP Bar (progress bar style) - at bottom
 * - Hope, Stress, Armor shapes - on sides like gm-daggerheart
 * - Status badges - at top
 */

import OBR, { buildShape, buildText, Image, Item } from "@owlbear-rodeo/sdk";
import { DaggerheartVitals, DaggerheartStatuses } from "./storage";

const ATTACHMENT_PREFIX = "com.fateweaver.attachment";

// Colors matching the fullscreen menu
const STAT_COLORS = {
    hope: { stroke: "#fbbf24" },      // Amber
    stress: { stroke: "#c084fc" },    // Purple  
    armor: { stroke: "#7dd3fc" },     // Sky blue
};

// Status badge colors and abbreviations - matching fullscreen menu (DaggerheartStats.tsx)
const STATUS_BADGES: Record<keyof DaggerheartStatuses, { color: string; bg: string; abbr: string }> = {
    vulnerable: { color: "#f87171", bg: "#450a0a", abbr: "VUL" },    // text-red-400
    blinded: { color: "#c084fc", bg: "#3b0764", abbr: "BLN" },       // text-purple-400
    frightened: { color: "#facc15", bg: "#422006", abbr: "FRT" },   // text-yellow-400
    hidden: { color: "#94a3b8", bg: "#1e293b", abbr: "HID" },        // text-slate-400
    restrained: { color: "#fb923c", bg: "#431407", abbr: "RST" },   // text-orange-400
    slowed: { color: "#60a5fa", bg: "#1e3a8a", abbr: "SLW" },        // text-blue-400
    weakened: { color: "#f472b6", bg: "#831843", abbr: "WKN" },      // text-pink-400
    empowered: { color: "#34d399", bg: "#064e3b", abbr: "EMP" },     // text-emerald-400
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

    // === DIMENSIONS (matching gm-daggerheart exactly) ===
    const height = Math.abs(Math.ceil(absHeight / 4.85));  // HP bar height
    const width = absWidth;
    const border = Math.floor(width / 75);
    const shapeSize = absWidth / 3;

    // HP bar position (at bottom with offset)
    const barPosition = {
        x: bounds.width < 0 ? bounds.position.x - width : bounds.position.x,
        y: bounds.position.y + absHeight - height - absHeight / 10,
    };

    // === HP BAR (matching gm-daggerheart: fillOpacity 0.5, strokeOpacity 0) ===
    const hpPercentage = vitals.hpMax > 0 ? vitals.hp / vitals.hpMax : 0;

    // HP Bar Background
    const hpBg = buildShape()
        .shapeType("RECTANGLE")
        .width(width)
        .height(height)
        .fillColor("black")
        .fillOpacity(0.5)
        .strokeColor("black")
        .strokeOpacity(0)
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
    const fillWidth = hpPercentage > 0 ? (width - border * 2) * hpPercentage : 0;
    const hpFill = buildShape()
        .shapeType("RECTANGLE")
        .width(fillWidth)
        .height(height - border * 2)
        .fillColor("red")
        .fillOpacity(0.5)
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

    // HP Text (matching gm-daggerheart: centered, bottom aligned, fontSize = height)
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
        .textAlignVertical("BOTTOM")
        .fontWeight(600)
        .fillColor("#ffffff")
        .strokeColor("black")
        .strokeWidth(2)
        .fontSize(height)
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

    // === HOPE (top-left, circle) ===
    const hopeCircle = buildShape()
        .shapeType("CIRCLE")
        .width(shapeSize * 0.7)
        .height(shapeSize * 0.7)
        .fillColor("black")
        .fillOpacity(0.5)
        .strokeWidth(shapeSize / 25)
        .strokeColor(STAT_COLORS.hope.stroke)
        .position({
            x: barPosition.x,
            y: bounds.position.y + absHeight - shapeSize / 0.75 - height - absHeight / 10,
        })
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
        .width(shapeSize / 1.5)
        .height(height)
        .position({
            x: barPosition.x,
            y: bounds.position.y + absHeight - shapeSize * 1.25 - height - absHeight / 10,
        })
        .attachedTo(tokenId)
        .layer(token.layer)
        .plainText(`${vitals.hope}`)
        .locked(true)
        .textAlign("CENTER")
        .textAlignVertical("BOTTOM")
        .fontWeight(600)
        .fillColor("#ffffff")
        .strokeColor("black")
        .strokeWidth(2)
        .fontSize(height - 3)
        .lineHeight(1)
        .disableHit(true)
        .disableAttachmentBehavior(["ROTATION"])
        .visible(token.visible)
        .zIndex(token.zIndex + 4)
        .name(`${ATTACHMENT_PREFIX}.hope.text`)
        .build();

    // === STRESS (left side, below hope, hexagon) ===
    const stressShape = buildShape()
        .shapeType("HEXAGON")
        .width(shapeSize * 0.7)
        .height(shapeSize * 0.7)
        .fillColor("black")
        .fillOpacity(0.5)
        .strokeWidth(shapeSize / 25)
        .strokeColor(STAT_COLORS.stress.stroke)
        .position({
            x: barPosition.x + shapeSize * 0.34,
            y: bounds.position.y + absHeight - shapeSize * 0.77,
        })
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
        .width(shapeSize * 0.7)
        .height(height)
        .position({
            x: barPosition.x,
            y: bounds.position.y + absHeight - shapeSize
        })
        .attachedTo(tokenId)
        .layer(token.layer)
        .plainText(`${vitals.stress}`)
        .locked(true)
        .textAlign("CENTER")
        .textAlignVertical("BOTTOM")
        .fontWeight(600)
        .fillColor("#ffffff")
        .strokeColor("black")
        .strokeWidth(2)
        .fontSize(height - 3)
        .lineHeight(1)
        .disableHit(true)
        .disableAttachmentBehavior(["ROTATION"])
        .visible(token.visible)
        .zIndex(token.zIndex + 4)
        .name(`${ATTACHMENT_PREFIX}.stress.text`)
        .build();

    // === ARMOR (top-right, circle) ===
    const armorCircle = buildShape()
        .shapeType("CIRCLE")
        .width(shapeSize * 0.7)
        .height(shapeSize * 0.7)
        .fillColor("black")
        .fillOpacity(0.5)
        .strokeWidth(shapeSize / 25)
        .strokeColor(STAT_COLORS.armor.stroke)
        .position({
            x: bounds.position.x + (bounds.width < 0 ? 0 : absWidth) - shapeSize / 1.5,
            y: bounds.position.y + absHeight - shapeSize / 0.75 - height - absHeight / 10,
        })
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
        .width(shapeSize / 1.5)
        .height(height)
        .position({
            x: bounds.position.x + (bounds.width < 0 ? 0 : absWidth) - shapeSize / 1.5,
            y: bounds.position.y + absHeight - shapeSize * 1.2 - height - absHeight / 10,
        })
        .attachedTo(tokenId)
        .layer(token.layer)
        .plainText(`${vitals.armor}`)
        .locked(true)
        .textAlign("CENTER")
        .textAlignVertical("BOTTOM")
        .fontWeight(600)
        .fillColor("#ffffff")
        .strokeColor("black")
        .strokeWidth(2)
        .fontSize(height - 3)
        .lineHeight(1)
        .disableHit(true)
        .disableAttachmentBehavior(["ROTATION"])
        .visible(token.visible)
        .zIndex(token.zIndex + 4)
        .name(`${ATTACHMENT_PREFIX}.armor.text`)
        .build();

    hopeCircle.metadata[ATTACHMENT_PREFIX] = { type: "hope.bg" };
    hopeText.metadata[ATTACHMENT_PREFIX] = { type: "hope.text" };
    stressShape.metadata[ATTACHMENT_PREFIX] = { type: "stress.bg" };
    stressText.metadata[ATTACHMENT_PREFIX] = { type: "stress.text" };
    armorCircle.metadata[ATTACHMENT_PREFIX] = { type: "armor.bg" };
    armorText.metadata[ATTACHMENT_PREFIX] = { type: "armor.text" };

    items.push(hopeCircle, hopeText, stressShape, stressText, armorCircle, armorText);

    // === STATUS BADGES (at top of token) ===
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
