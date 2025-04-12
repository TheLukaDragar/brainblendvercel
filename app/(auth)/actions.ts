'use server';

import { z } from 'zod';

import { createUser, getUser } from '@/lib/db/queries';
import { extractExpertiseTags } from '@/lib/constants';

import { signIn } from './auth';

const authFormSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  expertise: z.string().optional(),
  expertiseTags: z.string().optional(),
});

export interface LoginActionState {
  status: 'idle' | 'in_progress' | 'success' | 'failed' | 'invalid_data';
}

export const login = async (
  _: LoginActionState,
  formData: FormData,
): Promise<LoginActionState> => {
  try {
    const validatedData = authFormSchema.parse({
      email: formData.get('email'),
      password: formData.get('password'),
    });

    await signIn('credentials', {
      email: validatedData.email,
      password: validatedData.password,
      redirect: false,
    });

    return { status: 'success' };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { status: 'invalid_data' };
    }

    return { status: 'failed' };
  }
};

export interface RegisterActionState {
  status:
    | 'idle'
    | 'in_progress'
    | 'success'
    | 'failed'
    | 'user_exists'
    | 'invalid_data';
}

export const register = async (
  _: RegisterActionState,
  formData: FormData,
): Promise<RegisterActionState> => {
  try {
    const validatedData = authFormSchema.parse({
      email: formData.get('email'),
      password: formData.get('password'),
      expertise: formData.get('expertise') || '',
      expertiseTags: formData.get('expertiseTags') || '',
    });

    const [user] = await getUser(validatedData.email);

    if (user) {
      return { status: 'user_exists' } as RegisterActionState;
    }

    // Parse expertise tags or extract them from the expertise text
    let expertiseTags: string[] = [];
    if (validatedData.expertiseTags) {
      try {
        expertiseTags = JSON.parse(validatedData.expertiseTags);
      } catch (e) {
        // If parsing fails, extract tags from expertise text
        expertiseTags = extractExpertiseTags(validatedData.expertise || '');
      }
    } else if (validatedData.expertise) {
      // Extract tags from expertise if no tags were provided
      expertiseTags = extractExpertiseTags(validatedData.expertise);
    }

    await createUser(
      validatedData.email, 
      validatedData.password, 
      validatedData.expertise,
      expertiseTags
    );
    
    await signIn('credentials', {
      email: validatedData.email,
      password: validatedData.password,
      redirect: false,
    });

    return { status: 'success' };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { status: 'invalid_data' };
    }

    return { status: 'failed' };
  }
};
