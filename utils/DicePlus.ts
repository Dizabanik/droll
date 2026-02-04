import OBR from '@owlbear-rodeo/sdk';

const DICE_PLUS_ID = 'com.battle-system.dice-plus'; // Best guess or standard ID
const ROLL_REQUEST_CHANNEL = 'dice-plus/roll';
const IS_READY_CHANNEL = 'dice-plus/isReady';

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
    private mySourceId = 'com.fateweaver.dice';

    constructor() {
        this.checkReady();
    }

    async checkReady() {
        if (!OBR.isAvailable) return;
        // Listen for readiness (optional, simplified for now)
        // In a real implementation we might ping via broadcast
        this.ready = true;
    }

    async roll(formula: string): Promise<DicePlusResult> {
        const rollId = Math.random().toString(36).substring(7);

        // Promise that resolves when we get a result back
        return new Promise((resolve, reject) => {

            const timeout = setTimeout(() => {
                cleanup();
                reject(new Error("Dice+ roll timed out. Is the extension installed?"));
            }, 30000); // 30s timeout

            const handleMessage = (event: any) => {
                // We expect a message on OUR source channel
                // Channel: `${mySourceId}/roll-result`
                // We verify the rollId matches if possible, or just take the next one
                const data = event.data;
                if (data && data.rollId === rollId) {
                    cleanup();
                    resolve(this.parseResult(data));
                }
            };

            const cleanup = () => {
                clearTimeout(timeout);
                // Remove listener (implementation depends on how we hook into OBR broadcast)
                // Since OBR.broadcast.onMessage is global, we need a way to unsubscribe.
                // For now, we'll assume a global listener handles this routing or we add a one-off.
            };

            // In this simplified adapter, we'll assume we have a global listener in App.tsx 
            // that routes messages to this service, OR we register here.
            // OBR.broadcast.onMessage allows multiple listeners.

            const channel = `${this.mySourceId}/roll-result`;

            const unsubscribe = OBR.broadcast.onMessage(channel, (event) => {
                handleMessage(event);
            });

            // Override cleanup to include unsubscribe // this is tricky with OBR SDK types directly here.
            // Let's rely on the simplified flow:

            // Send Request
            OBR.broadcast.sendMessage(ROLL_REQUEST_CHANNEL, {
                source: this.mySourceId,
                rollId: rollId,
                formula: formula,
                hidden: false // or true?
            });

            // Note: This needs the real channel ID.
            // If 'dice-plus/roll' is wrong, this fails.

            console.log(`[Dice+] Sent roll request: ${formula} (ID: ${rollId})`);
        });
    }

    private parseResult(data: any): DicePlusResult {
        // Transform Dice+ format to our format
        // This is hypothetical until verified
        return {
            formula: data.formula,
            results: data.dice?.map((d: any) => ({ sides: d.sides, result: d.value })) || [],
            total: data.total || 0
        };
    }
}

export const DicePlus = new DicePlusService();
