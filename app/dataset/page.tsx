import { DatasetTable } from '@/components/dataset-table';

export const metadata = {
  title: 'Dataset - Brain Blend',
  description: 'View all accepted expert responses in our community dataset.',
};

export default async function DatasetPage() {
  return (
    <div className="flex flex-col min-w-0 h-dvh bg-background">
      <div className="flex items-center transition-colors duration-300">
        <header className="flex sticky top-0 py-1.5 items-center px-2 md:px-2 gap-2 w-full">
          <div className="flex items-center justify-between w-full px-4">
            <h1 className="text-xl font-bold">Dataset</h1>
            <p className="text-sm text-muted-foreground">
              Expert-approved responses from our community
            </p>
          </div>
        </header>
      </div>

      <div className="flex-1 overflow-auto px-4">
        <div className="max-w-6xl mx-auto py-6">
          <DatasetTable />
        </div>
      </div>
    </div>
  );
} 