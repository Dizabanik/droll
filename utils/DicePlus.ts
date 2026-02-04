import OBR from '@owlbear-rodeo/sdk';

// Verified Channel IDs
const ROLL_REQUEST_CHANNEL = 'dice-plus/roll-request';
// Results come back on `${source}/roll-result`

export interface DicePlusResult {
    formula: string;
    results: {
        sides: number;
        result: number;
    }[];
    total: number;
}

class DicePlusService {
    private ready = false;
    // This source ID is critical. It determines where Dice+ sends the answer.
    private mySourceId = 'com.fateweaver.dice';

    constructor() {
        this.checkReady();
    }

    async checkReady() {
        if (!OBR.isAvailable) return;
        this.ready = true;
    }

    async roll(formula: string): Promise<DicePlusResult> {
        const rollId = Math.random().toString(36).substring(7);

        // If OBR is not available (local dev), return mock immediately to prevent hang
        if (!OBR.isAvailable) {
            console.warn("[Dice+] OBR not available, returning mock result.");
            return this.mockResult(formula);
        }

        return new Promise((resolve, reject) => {
            // 5s timeout to prevent infinite stuck state
            const timeout = setTimeout(() => {
                cleanup();
                console.warn("[Dice+] Roll timed out (no response from Dice+). Returning mock result for continuity.");
                resolve(this.mockResult(formula));
            }, 5000);

            const handleMessage = (event: any) => {
                const data = event.data;
                // Dice+ sends result with matching rollId we sent
                if (data && data.rollId === rollId) {
                    cleanup();
                    resolve(this.parseResult(data));
                }
            };

            const cleanup = () => {
                clearTimeout(timeout);
                // OBR broadcast listeners are global, typically handled by one-time subscription or global router.
                // For this implementation, we register a temporary listener.
                unsubscribe();
            };

            // Register listener for THIS specific roll transaction
            const resultChannel = `${this.mySourceId}/roll-result`;
            const unsubscribe = OBR.broadcast.onMessage(resultChannel, (event) => {
                handleMessage(event);
            });

            // Payload matching Dice+ requirements
            const payload = {
                rollId: rollId,
                playerId: 'unknown', // OBR.player.id ideally, but we might not have it inside this class easily without async
                playerName: 'FateWeaver',
                rollTarget: 'everyone',
                diceNotation: formula,
                showResults: false, // We want to handle results ourselves
                timestamp: Date.now(),
                source: this.mySourceId // Crucial: tells Dice+ where to send result
            };

            // Send Request
            OBR.broadcast.sendMessage(ROLL_REQUEST_CHANNEL, payload).catch(err => {
                console.error("[Dice+] Send failed:", err);
                cleanup();
                // Fallback to mock if send fails completely
                resolve(this.mockResult(formula));
            });

            console.log(`[Dice+] Sent request to ${ROLL_REQUEST_CHANNEL}`, payload);
        });
    }

    // Fallback for local dev or timeout
    private mockResult(formula: string): DicePlusResult {
        // Very basic parser for mock purposes: "1d20+5" -> just rand(20)
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

        return {
            formula,
            results,
            total
        };
    }

    private parseResult(data: any): DicePlusResult {
        // Dice+ 'dice' array contains individual die results
        // We map them to our interface
        return {
            formula: data.diceNotation || data.formula, // field might vary
            results: data.dice?.map((d: any) => ({ sides: d.sides || 20, result: d.result || d.value })) || [],
            total: data.total || 0 // Dice+ usually calculates total
        };
    }
}

export const DicePlus = new DicePlusService();
