export const QUEUES = {
  PASTE_EXPIRATION: 'paste-expiration',
} as const;

export type QueueName = (typeof QUEUES)[keyof typeof QUEUES];

export interface PasteExpirationJobData {
  pasteId: string;
}
