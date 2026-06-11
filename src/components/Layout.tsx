import { ReactNode } from 'react';
import { AppSidebar } from '@/components/AppSidebar';
import { SidebarInset, SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';

interface LayoutProps {
  children: ReactNode;
}

export const Layout = ({ children }: LayoutProps) => {
  return (
    <SidebarProvider
      defaultOpen
      style={{ '--sidebar-width': '19rem' } as React.CSSProperties}
    >
      <div className="min-h-[100dvh] flex w-full bg-background">
        <AppSidebar />

        <SidebarInset className="flex min-h-screen flex-1 flex-col">
          <header className="sticky top-0 z-40 flex h-14 items-center gap-3 border-b border-border/60 bg-background/95 px-5 backdrop-blur supports-[backdrop-filter]:bg-background/85 shadow-sm">
            <SidebarTrigger className="h-8 w-8 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors" />
            <div className="h-5 w-px bg-border/60" />
            <span className="text-sm font-semibold text-muted-foreground select-none hidden sm:block tracking-wide">
              Tribuna IA
            </span>
          </header>

          <main className="flex-1 p-5 md:p-7">{children}</main>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
};
