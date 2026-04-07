import type { PasteMode, PasteVisibility } from '@pasteking/types';

export interface CreatePasteData {
  title?: string;
  content: string;
  mode: PasteMode;
  visibility: PasteVisibility;
  language?: string;
  burnAfterRead: boolean;
  expiresAt: Date | null;
  deleteTokenHash?: string;
  authorId?: string;
  workspaceId?: string;
  contentRef?: string | null;
  encrypted?: boolean;
  encryptionIv?: string | null;
  encryptionVersion?: number | null;
}

export interface UpdatePasteData {
  title?: string;
  content: string;
  language?: string;
  contentRef?: string | null;
}

export interface PasteWithContent {
  id: string;
  title: string | null;
  mode: string;
  visibility: string;
  status: string;
  moderationStatus: string;
  language: string | null;
  encrypted: boolean;
  encryptionIv: string | null;
  encryptionVersion: number | null;
  burnAfterRead: boolean;
  expiresAt: Date | null;
  currentRevision: number;
  content: string | null;
  contentRef: string | null;
  deleteTokenHash: string | null;
  authorId: string | null;
  workspaceId: string | null;
  forkedFromId: string | null;
  deleteReason: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface PasteRevisionRow {
  id: string;
  revisionNumber: number;
  content: string | null;
  contentRef: string | null;
  contentHash: string | null;
  createdAt: Date;
}
