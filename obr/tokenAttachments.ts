/**
 * Token Attachment Helpers
 * Creates stat visualizations attached to tokens:
 * - HP Bar (progress bar style)
 * - Hope, Stress, Armor pills (circles)
 */

import OBR, { buildShape, buildText, Image, Item } from "@owlbear-rodeo/sdk";
import { DaggerheartVitals } from "./storage";

const ATTACHMENT_PREFIX = "com.fateweaver.attachment";

// Colors matching the fullscreen menu pills
const STAT_COLORS = {
    hope: { fill: "rgba(180, 83, 9, 0.5)", stroke: "#fbbf24", text: "#fcd34d" },    // Amber
    stress: { fill: "rgba(88, 28, 135, 0.5)", stroke: "#c084fc", text: "#d8b4fe" }, // Purple
    hp: { fill: "rgba(127, 29, 29, 0.6)", stroke: "#fca5a5", bar: "#ef4444" },      // Red
    armor: { fill: "rgba(12, 74, 110, 0.5)", stroke: "#7dd3fc", text: "#bae6fd" },  // Sky blue
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

export const createTokenAttachments = async (tokenId: string, vitals: DaggerheartVitals): Promise<void> => {
    const token = await getToken(tokenId);
    const bounds = await getTokenBounds(tokenId);
    if (!token || !bounds) return;

    const items: Item[] = [];

    // === HP BAR (at bottom of token) ===
    const barHeight = Math.abs(bounds.height * 0.08);
    const barWidth = Math.abs(bounds.width * 0.9);
    const border = Math.max(2, barWidth * 0.01);
    const hpPercentage = vitals.hpMax > 0 ? vitals.hp / vitals.hpMax : 0;

    const barPosition = {
        x: bounds.position.x + (bounds.width - barWidth) / 2,
        y: bounds.position.y + bounds.height - barHeight - bounds.height * 0.05,
    };

    // HP Bar Background
    const hpBg = buildShape()
        .shapeType("RECTANGLE")
        .width(barWidth)
        .height(barHeight)
        .fillColor("#000000")
        .fillOpacity(0.6)
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
        .fillOpacity(0.7)
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

    // HP Text (centered on bar)
    const hpText = buildText()
        .textType("PLAIN")
        .width(barWidth)
        .height(barHeight)
        .position(barPosition)
        .attachedTo(tokenId)
        .layer(token.layer)
        .plainText(`${vitals.hp}/${vitals.hpMax}`)
        .locked(true)
        .textAlign("CENTER")
        .textAlignVertical("MIDDLE")
        .fontWeight(700)
        .fillColor("#ffffff")
        .strokeColor("#000000")
        .strokeWidth(2)
        .fontSize(Math.max(10, barHeight * 0.7))
        .lineHeight(1)
        .disableHit(true)
        .disableAttachmentBehavior(["ROTATION"])
        .visible(token.visible)
        .zIndex(token.zIndex + 3)
        .name(`${ATTACHMENT_PREFIX}.hp.text`)
        .build();

    hpBg.metadata[ATTACHMENT_PREFIX] = { type: "hp.bg" };
    hpFill.metadata[ATTACHMENT_PREFIX] = { type: "hp.fill" };
    hpText.metadata[ATTACHMENT_PREFIX] = { type: "hp.text" };
    items.push(hpBg, hpFill, hpText);

    // === STAT PILLS (above HP bar) ===
    const pillRadius = Math.min(bounds.width, bounds.height) * 0.1;
    const pillSpacing = pillRadius * 2.5;
    const pillY = barPosition.y - pillRadius * 2.2;
    const pillCenterX = bounds.position.x + bounds.width / 2;

    // 3 pills: Hope, Stress, Armor
    const pillStats = [
        { key: "hope" as const, value: vitals.hope },
        { key: "stress" as const, value: vitals.stress },
        { key: "armor" as const, value: vitals.armor },
    ];

    const pillStartX = pillCenterX - pillSpacing;

    for (let i = 0; i < pillStats.length; i++) {
        const stat = pillStats[i];
        const colors = STAT_COLORS[stat.key];
        const posX = pillStartX + (pillSpacing * i);

        // Pill background
        const pill = buildShape()
            .shapeType("CIRCLE")
            .width(pillRadius * 2)
            .height(pillRadius * 2)
            .fillColor(colors.fill)
            .fillOpacity(0.9)
            .strokeColor(colors.stroke)
            .strokeWidth(Math.max(2, pillRadius * 0.12))
            .position({ x: posX - pillRadius, y: pillY - pillRadius })
            .attachedTo(tokenId)
            .layer(token.layer)
            .locked(true)
            .disableHit(true)
            .disableAttachmentBehavior(["ROTATION"])
            .visible(token.visible)
            .zIndex(token.zIndex + 2)
            .name(`${ATTACHMENT_PREFIX}.${stat.key}.bg`)
            .build();

        // Pill value text
        const pillText = buildText()
            .textType("PLAIN")
            .width(pillRadius * 2)
            .height(pillRadius * 2)
            .position({ x: posX - pillRadius, y: pillY - pillRadius })
            .attachedTo(tokenId)
            .layer(token.layer)
            .plainText(`${stat.value}`)
            .locked(true)
            .textAlign("CENTER")
            .textAlignVertical("MIDDLE")
            .fontWeight(700)
            .fillColor("#ffffff")
            .strokeColor("#000000")
            .strokeWidth(2)
            .fontSize(Math.max(12, pillRadius * 0.9))
            .lineHeight(1)
            .disableHit(true)
            .disableAttachmentBehavior(["ROTATION"])
            .visible(token.visible)
            .zIndex(token.zIndex + 3)
            .name(`${ATTACHMENT_PREFIX}.${stat.key}.text`)
            .build();

        pill.metadata[ATTACHMENT_PREFIX] = { type: `${stat.key}.bg` };
        pillText.metadata[ATTACHMENT_PREFIX] = { type: `${stat.key}.text` };
        items.push(pill, pillText);
    }

    try {
        await OBR.scene.items.addItems(items);
    } catch (e) {
        console.error("Failed to add token attachments:", e);
    }
};

export const updateTokenAttachments = async (tokenId: string, vitals: DaggerheartVitals): Promise<void> => {
    try {
        const attachments = await OBR.scene.items.getItemAttachments([tokenId]);
        const ourAttachments = attachments.filter(item =>
            item.name?.startsWith(ATTACHMENT_PREFIX)
        );

        if (ourAttachments.length === 0) {
            await createTokenAttachments(tokenId, vitals);
            return;
        }

        // Get token bounds for HP bar width calculation
        const bounds = await getTokenBounds(tokenId);
        if (!bounds) return;

        const barWidth = Math.abs(bounds.width * 0.9);
        const border = Math.max(2, barWidth * 0.01);
        const hpPercentage = vitals.hpMax > 0 ? vitals.hp / vitals.hpMax : 0;
        const fillWidth = hpPercentage > 0 ? (barWidth - border * 2) * hpPercentage : 0;

        // Update values
        await OBR.scene.items.updateItems(ourAttachments, (items) => {
            for (const item of items) {
                if (item.name === `${ATTACHMENT_PREFIX}.hp.fill`) {
                    // Update HP bar fill width
                    (item as any).width = fillWidth;
                } else if (item.name === `${ATTACHMENT_PREFIX}.hp.text`) {
                    // Update HP text
                    (item as any).text.plainText = `${vitals.hp}/${vitals.hpMax}`;
                } else if (item.name === `${ATTACHMENT_PREFIX}.hope.text`) {
                    (item as any).text.plainText = `${vitals.hope}`;
                } else if (item.name === `${ATTACHMENT_PREFIX}.stress.text`) {
                    (item as any).text.plainText = `${vitals.stress}`;
                } else if (item.name === `${ATTACHMENT_PREFIX}.armor.text`) {
                    (item as any).text.plainText = `${vitals.armor}`;
                }
            }
        });
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
