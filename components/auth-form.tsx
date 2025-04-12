import Form from 'next/form';

import { Input } from './ui/input';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';

export function AuthForm({
  action,
  children,
  defaultEmail = '',
  isRegistration = false,
  defaultExpertise = '',
}: {
  action: NonNullable<
    string | ((formData: FormData) => void | Promise<void>) | undefined
  >;
  children: React.ReactNode;
  defaultEmail?: string;
  isRegistration?: boolean;
  defaultExpertise?: string;
}) {
  return (
    <Form action={action} className="flex flex-col gap-4 px-4 sm:px-16">
      <div className="flex flex-col gap-2">
        <Label
          htmlFor="email"
          className="text-zinc-600 font-normal dark:text-zinc-400"
        >
          Email Address
        </Label>

        <Input
          id="email"
          name="email"
          className="bg-muted text-md md:text-sm"
          type="email"
          placeholder="user@acme.com"
          autoComplete="email"
          required
          autoFocus
          defaultValue={defaultEmail}
        />
      </div>

      <div className="flex flex-col gap-2">
        <Label
          htmlFor="password"
          className="text-zinc-600 font-normal dark:text-zinc-400"
        >
          Password
        </Label>

        <Input
          id="password"
          name="password"
          className="bg-muted text-md md:text-sm"
          type="password"
          required
        />
      </div>

      {isRegistration && (
        <div className="flex flex-col gap-2">
          <Label
            htmlFor="expertise"
            className="text-zinc-600 font-normal dark:text-zinc-400"
          >
            Your Expertise
          </Label>
          <Textarea
            id="expertise"
            name="expertise"
            className="bg-muted text-md md:text-sm resize-none min-h-[100px]"
            placeholder="Describe your expertise, skills, or areas of interest..."
            defaultValue={defaultExpertise}
          />
          <p className="text-xs text-zinc-500 dark:text-zinc-500 mt-1">
            We'll use this to personalize your experience and suggest relevant question best suited for you
          </p>
        </div>
      )}

      {children}
    </Form>
  );
}
