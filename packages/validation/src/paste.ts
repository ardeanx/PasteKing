import { z } from 'zod';
import { PasteMode, PasteVisibility } from '@pasteking/types';

export const createPasteSchema = z.object({
  title: z.string().max(200).optional(),
  content: z.string().min(1, 'Content is required').max(500_000, 'Content too large'),
  mode: z.enum([PasteMode.CODE, PasteMode.TEXT, PasteMode.LOG, PasteMode.MARKDOWN]),
  visibility: z.enum([PasteVisibility.PUBLIC, PasteVisibility.UNLISTED, PasteVisibility.PRIVATE]),
  language: z.string().max(50).optional(),
  burnAfterRead: z.boolean().default(false),
  expiresIn: z
    .number()
    .int()
    .positive()
    .max(60 * 60 * 24 * 365) // max 1 year
    .optional(),
  encrypted: z.boolean().default(false),
  encryptionIv: z.string().max(100).optional(),
  encryptionVersion: z.number().int().min(1).max(1).optional(),
}).refine(
  (data) => {
    if (data.encrypted) {
      return !!data.encryptionIv && !!data.encryptionVersion;
    }
    return true;
  },
  { message: 'Encrypted pastes require encryptionIv and encryptionVersion', path: ['encrypted'] },
);

export type CreatePasteSchema = z.infer<typeof createPasteSchema>;

export const updatePasteSchema = z.object({
  title: z.string().max(200).optional(),
  content: z.string().min(1, 'Content is required').max(500_000, 'Content too large'),
  language: z.string().max(50).optional(),
});

export type UpdatePasteSchema = z.infer<typeof updatePasteSchema>;
