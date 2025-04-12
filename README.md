<a href="https://chat.vercel.ai/">
  <img alt="Next.js 14 and App Router-ready AI chatbot." src="app/(chat)/opengraph-image.png">
  <h1 align="center">Chat SDK</h1>
</a>

<p align="center">
    Chat SDK is a free, open-source template built with Next.js and the AI SDK that helps you quickly build powerful chatbot applications.
</p>

<p align="center">
  <a href="https://chat-sdk.dev"><strong>Read Docs</strong></a> ·
  <a href="#features"><strong>Features</strong></a> ·
  <a href="#model-providers"><strong>Model Providers</strong></a> ·
  <a href="#deploy-your-own"><strong>Deploy Your Own</strong></a> ·
  <a href="#running-locally"><strong>Running locally</strong></a>
</p>
<br/>

## Features

- [Next.js](https://nextjs.org) App Router
  - Advanced routing for seamless navigation and performance
  - React Server Components (RSCs) and Server Actions for server-side rendering and increased performance
- [AI SDK](https://sdk.vercel.ai/docs)
  - Unified API for generating text, structured objects, and tool calls with LLMs
  - Hooks for building dynamic chat and generative user interfaces
  - Supports xAI (default), OpenAI, Fireworks, and other model providers
- [shadcn/ui](https://ui.shadcn.com)
  - Styling with [Tailwind CSS](https://tailwindcss.com)
  - Component primitives from [Radix UI](https://radix-ui.com) for accessibility and flexibility
- Data Persistence
  - [Neon Serverless Postgres](https://vercel.com/marketplace/neon) for saving chat history and user data
  - [Vercel Blob](https://vercel.com/storage/blob) for efficient file storage
- [Auth.js](https://authjs.dev)
  - Simple and secure authentication

## Model Providers

This template ships with [xAI](https://x.ai) `grok-2-1212` as the default chat model. However, with the [AI SDK](https://sdk.vercel.ai/docs), you can switch LLM providers to [OpenAI](https://openai.com), [Anthropic](https://anthropic.com), [Cohere](https://cohere.com/), and [many more](https://sdk.vercel.ai/providers/ai-sdk-providers) with just a few lines of code.

## Deploy Your Own

You can deploy your own version of the Next.js AI Chatbot to Vercel with one click:

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fvercel%2Fai-chatbot&env=AUTH_SECRET&envDescription=Generate%20a%20random%20secret%20to%20use%20for%20authentication&envLink=https%3A%2F%2Fgenerate-secret.vercel.app%2F32&project-name=my-awesome-chatbot&repository-name=my-awesome-chatbot&demo-title=AI%20Chatbot&demo-description=An%20Open-Source%20AI%20Chatbot%20Template%20Built%20With%20Next.js%20and%20the%20AI%20SDK%20by%20Vercel&demo-url=https%3A%2F%2Fchat.vercel.ai&products=%5B%7B%22type%22%3A%22integration%22%2C%22protocol%22%3A%22ai%22%2C%22productSlug%22%3A%22grok%22%2C%22integrationSlug%22%3A%22xai%22%7D%2C%7B%22type%22%3A%22integration%22%2C%22protocol%22%3A%22storage%22%2C%22productSlug%22%3A%22neon%22%2C%22integrationSlug%22%3A%22neon%22%7D%2C%7B%22type%22%3A%22blob%22%7D%5D)

## Running locally

You will need to use the environment variables [defined in `.env.example`](.env.example) to run Next.js AI Chatbot. It's recommended you use [Vercel Environment Variables](https://vercel.com/docs/projects/environment-variables) for this, but a `.env` file is all that is necessary.

> Note: You should not commit your `.env` file or it will expose secrets that will allow others to control access to your various AI and authentication provider accounts.

1. Install Vercel CLI: `npm i -g vercel`
2. Link local instance with Vercel and GitHub accounts (creates `.vercel` directory): `vercel link`
3. Download your environment variables: `vercel env pull`

```bash
pnpm install
pnpm dev
```

Your app template should now be running on [localhost:3000](http://localhost:3000).

## Contributing

We welcome contributions to Brain Blend! This guide will help you understand the project structure and get started with development.

### Project Structure

The codebase is organized as follows:

- `/app` - Next.js App Router routes and pages
  - `/(auth)` - Authentication-related pages (login, register)
  - `/(chat)` - Chat interface and functionality
- `/components` - Reusable React components
  - `/ui` - UI components (buttons, inputs, etc.)
- `/lib` - Utility functions and configurations
  - `/db` - Database schema, queries, and migrations

### Database Usage

We use Postgres with Drizzle ORM for database operations. The database schema is defined in `/lib/db/schema.ts`. Here's an overview of the main tables:

- `User` - User information including authentication and expertise
- `Chat` - Chat sessions
- `Message_v2` - Chat messages with support for rich content

#### Database Commands

Here are the key commands for working with the database:

```bash
# Generate a migration based on schema changes
npm run db:generate

# Apply migrations to your database
npm run db:migrate

# View your database with a visual interface
npm run db:studio

# Push schema changes directly to the database (use with caution)
npm run db:push

# Pull the database schema
npm run db:pull

# Check for schema drift
npm run db:check
```

### Development Workflow

1. Make changes to the database schema in `/lib/db/schema.ts`
2. Generate a migration using `npm run db:generate`
3. Apply the migration with `npm run db:migrate`
4. Update the related queries in `/lib/db/queries.ts`
5. Use the updated schema and queries in your components and routes

### Authentication

The authentication system uses NextAuth.js with a custom credentials provider. Authentication-related files:

- `/app/(auth)/actions.ts` - Server actions for login and registration
- `/app/(auth)/auth.ts` - NextAuth configuration
- `/components/auth-form.tsx` - Reusable authentication form component

### Making Changes

When contributing, please:

1. Fork the repository and create a feature branch
2. Make your changes following the existing code style
3. Add appropriate tests for your changes
4. Update documentation as needed
5. Submit a pull request with a clear description of the changes

For any questions or issues, please open an issue on GitHub.

### Example: Adding a User Expertise Field

This example demonstrates the process of adding a new field to the user registration system:

#### 1. Update the Database Schema

First, modify `lib/db/schema.ts` to include the new field:

```typescript
export const user = pgTable('User', {
  id: uuid('id').primaryKey().notNull().defaultRandom(),
  email: varchar('email', { length: 64 }).notNull(),
  password: varchar('password', { length: 64 }),
  expertise: text('expertise'), // Add the new field
});
```

#### 2. Update Database Queries

Modify the `createUser` function in `lib/db/queries.ts` to accept and store the new field:

```typescript
export async function createUser(email: string, password: string, expertise?: string) {
  const salt = genSaltSync(10);
  const hash = hashSync(password, salt);

  try {
    return await db.insert(user).values({ email, password: hash, expertise });
  } catch (error) {
    console.error('Failed to create user in database');
    throw error;
  }
}
```

#### 3. Update Form Component

Modify the `AuthForm` component in `components/auth-form.tsx` to include the new field:

```typescript
export function AuthForm({
  action,
  children,
  defaultEmail = '',
  isRegistration = false, // Add flag for registration form
  defaultExpertise = '',
}: {
  action: NonNullable<string | ((formData: FormData) => void | Promise<void>) | undefined>;
  children: React.ReactNode;
  defaultEmail?: string;
  isRegistration?: boolean;
  defaultExpertise?: string;
}) {
  return (
    <Form action={action} className="flex flex-col gap-4 px-4 sm:px-16">
      {/* Existing email and password fields */}
      
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
        </div>
      )}

      {children}
    </Form>
  );
}
```

#### 4. Update Action Handler

Modify the registration action in `app/(auth)/actions.ts` to handle the new field:

```typescript
const authFormSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  expertise: z.string().optional(),
});

export const register = async (
  _: RegisterActionState,
  formData: FormData,
): Promise<RegisterActionState> => {
  try {
    const validatedData = authFormSchema.parse({
      email: formData.get('email'),
      password: formData.get('password'),
      expertise: formData.get('expertise') || '',
    });

    // Existing user check logic...
    
    await createUser(validatedData.email, validatedData.password, validatedData.expertise);
    
    // Authentication logic...

    return { status: 'success' };
  } catch (error) {
    // Error handling...
  }
};
```

#### 5. Update Registration Page

Update the registration page in `app/(auth)/register/page.tsx` to use the new field:

```typescript
export default function Page() {
  // Existing state and hooks...
  const [expertise, setExpertise] = useState('');
  
  const handleSubmit = (formData: FormData) => {
    setEmail(formData.get('email') as string);
    setExpertise(formData.get('expertise') as string);
    formAction(formData);
  };

  return (
    <div className="flex h-dvh w-screen items-center justify-center">
      {/* Existing UI elements */}
      
      <AuthForm 
        action={handleSubmit} 
        defaultEmail={email} 
        isRegistration={true}
        defaultExpertise={expertise}
      >
        {/* Form content */}
      </AuthForm>
    </div>
  );
}
```

#### 6. Generate and Run Migrations

```bash
# Generate a migration for the schema changes
npm run db:generate

# Apply the migration to your database
npm run db:migrate
```

This example demonstrates a complete workflow for adding a new feature that spans the database schema, queries, UI components, and server actions.
