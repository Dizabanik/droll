import OBR from '@owlbear-rodeo/sdk';

// Verified Channel IDs
const ROLL_REQUEST_CHANNEL = 'dice-plus/roll-request';

export interface DicePlusResult {
    formula: string;
    results: {
        sides: number;
        result: number;
    }[];
    total: number;
    groups: any[]; // Raw groups from Dice+
}

class DicePlusService {
    private ready = false;
    // This source ID is critical. It determines where Dice+ sends the answer.
    private mySourceId = 'com.fateweaver.dice';

    constructor() {
        this.init();
    }

    async init() {
        if (!OBR.isAvailable) return;
        this.ready = true;

        // Listen for global errors from Dice+
        OBR.broadcast.onMessage(`${this.mySourceId}/roll-error`, (event) => {
            console.error("[Dice+] Received error from Dice+:", event.data);
        });
    }

    async roll(formula: string): Promise<DicePlusResult> {
        const rollId = `roll_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

        // If OBR is not available (local dev), return mock immediately to prevent hang
        if (!OBR.isAvailable) {
            console.warn("[Dice+] OBR not available, returning mock result.");
            return this.mockResult(formula);
        }

        return new Promise(async (resolve, reject) => {
            let unsubscribe: (() => void) | null = null;

            // 5s timeout to prevent infinite stuck state
            const timeout = setTimeout(() => {
                cleanup();
                console.warn("[Dice+] Roll timed out (no response from Dice+). Returning mock result for continuity.");
                resolve(this.mockResult(formula));
            }, 5000);

            const cleanup = () => {
                clearTimeout(timeout);
                if (unsubscribe) {
                    unsubscribe();
                }
            };

            const handleMessage = (event: any) => {
                const data = event.data;
                // Dice+ sends result with matching rollId we sent
                if (data && data.rollId === rollId) {
                    cleanup();
                    console.log("[Dice+] Received result:", data);
                    resolve(this.parseResult(data));
                }
            };

            // Register listener for THIS specific roll transaction
            const resultChannel = `${this.mySourceId}/roll-result`;
            unsubscribe = OBR.broadcast.onMessage(resultChannel, handleMessage);

            try {
                // Get Player Info (Dice+ requires valid IDs)
                const [pid, pname] = await Promise.all([
                    OBR.player.getId(),
                    OBR.player.getName()
                ]);

                const payload = {
                    rollId: rollId,
                    playerId: pid,
                    playerName: pname,
                    rollTarget: 'everyone',
                    diceNotation: formula,
                    showResults: false,
                    timestamp: Date.now(),
                    source: this.mySourceId
                };

                // Send Request with destination parameter
                await OBR.broadcast.sendMessage(
                    ROLL_REQUEST_CHANNEL,
                    payload,
                    { destination: 'ALL' }
                );

                console.log(`[Dice+] Sent request to ${ROLL_REQUEST_CHANNEL}`, payload);
            } catch (err) {
                console.error("[Dice+] Failed to send request:", err);
                cleanup();
                // Fallback to mock if send fails completely
                resolve(this.mockResult(formula));
            }
        });
    }

    // Fallback for local dev or timeout
    private mockResult(formula: string): DicePlusResult {
        // Basic parser for mock purposes: "1d20+5" -> just rand(20)
        // This is just to keep the automation chain moving
        const parts = formula.match(/(\d+)d(\d+)/);
        let sides = 20;
        let count = 1;
        if (parts) {
            count = parseInt(parts[1]);
            sides = parseInt(parts[2]);
        }

        const results = [];
        let total = 0;
        for (let i = 0; i < count; i++) {
            const val = Math.ceil(Math.random() * sides);
            results.push({ sides, result: val });
            total += val;
        }

        // Add modifier if present
        const modMatch = formula.match(/[+-](\d+)/);
        if (modMatch) {
            total += parseInt(modMatch[0]);
        }

        console.log("[Dice+] Mock result:", { formula, results, total });

        return {
            formula,
            results,
            total,
            groups: []
        };
    }

    private parseResult(data: any): DicePlusResult {
        // Official Dice+ Result Structure:
        // data.result.groups[] -> group.dice[] -> { value: number, diceType: string, kept: boolean }

        const rawResult = data.result;
        if (!rawResult) {
            console.warn("[Dice+] Received result without 'result' property", data);
            return { formula: data.diceNotation || "error", results: [], total: 0, groups: [] };
        }

        const flattenedResults: { sides: number; result: number }[] = [];

        if (rawResult.groups && Array.isArray(rawResult.groups)) {
            rawResult.groups.forEach((group: any) => {
                if (group.dice && Array.isArray(group.dice)) {
                    group.dice.forEach((d: any) => {
                        // Extract sides from "d20", "d6" etc
                        const type = d.diceType || group.diceType || "d20";
                        const sides = parseInt(type.replace(/[^\d]/g, '')) || 20;

                        // Include all dice (both kept and dropped)
                        // Your engine might need to see all dice to animate them properly
                        flattenedResults.push({
                            sides: sides,
                            result: d.value
                        });
                    });
                }
            });
        }

        return {
            formula: rawResult.diceNotation || data.diceNotation || "unknown",
            results: flattenedResults,
            total: rawResult.totalValue || 0,
            groups: rawResult.groups || []
        };
    }
}

export const DicePlus = new DicePlusService();