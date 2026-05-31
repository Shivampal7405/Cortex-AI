import { z } from 'zod';

export const BaseMessageSchema = z.object({
  type: z.string()
});
