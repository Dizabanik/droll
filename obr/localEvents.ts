/**
 * Local Client Events
 * Communicates ONLY between iframes on the SAME browser tab / player client.
 * NEVER broadcasts over the network to other players!
 */
import { DicePreset } from '../types';

export interface LocalQuickRollMessage {
  type: 'LOCAL_QUICK_ROLL';
  preset: DicePreset;
  itemName: string;
}

const LOCAL_CHANNEL_NAME = 'fateweaver_local_client_events';

export const sendLocalQuickRoll = (preset: DicePreset, itemName: string) => {
  try {
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      const channel = new BroadcastChannel(LOCAL_CHANNEL_NAME);
      channel.postMessage({
        type: 'LOCAL_QUICK_ROLL',
        preset,
        itemName,
      } as LocalQuickRollMessage);
      channel.close();
    }
  } catch (e) {
    console.error('Failed to send local quick roll:', e);
  }
};

export const onLocalQuickRoll = (callback: (preset: DicePreset, itemName: string) => void) => {
  if (typeof window === 'undefined' || !('BroadcastChannel' in window)) {
    return () => {};
  }

  const channel = new BroadcastChannel(LOCAL_CHANNEL_NAME);
  channel.onmessage = (event: MessageEvent<LocalQuickRollMessage>) => {
    if (event.data && event.data.type === 'LOCAL_QUICK_ROLL') {
      callback(event.data.preset, event.data.itemName);
    }
  };

  return () => {
    channel.close();
  };
};
