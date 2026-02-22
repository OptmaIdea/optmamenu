import { z } from 'zod';

export const productFormSchema = z.object({
  name: z.string().optional(),
});

export type ProductFormValues = z.infer<typeof productFormSchema>;
