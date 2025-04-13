import { auth } from '@/app/(auth)/auth';
import { redirect } from 'next/navigation';
import { ProfileForm } from '@/components/profile-form';

export default async function ProfilePage() {
  const session = await auth();
  
  if (!session?.user) {
    redirect('/');
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto py-8 h-full">
        <div className="max-w-2xl mx-auto h-full">
          <h1 className="text-3xl font-bold mb-8">Profile Settings</h1>
          <ProfileForm user={session.user} />
        </div>
      </div>
    </div>
  );
} 