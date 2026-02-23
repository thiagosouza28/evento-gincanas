import { Sidebar } from './Sidebar';

interface MainLayoutProps {
  children: React.ReactNode;
}

export function MainLayout({ children }: MainLayoutProps) {
  return (
    <div className="min-h-screen bg-background">
      <Sidebar />
      <main className="ml-64 min-h-screen py-8 pl-5 pr-5 lg:pl-6 lg:pr-8 xl:pr-10">
        <div className="w-full">
          {children}
        </div>
      </main>
    </div>
  );
}
