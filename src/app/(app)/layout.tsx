import { InstallBanner } from "@/components/pwa/install";
import { OnlineBanner } from "@/components/layout/online-banner";
import { RouteProgress } from "@/components/layout/route-progress";
import { MobileNav } from "@/components/layout/mobile-nav";
import { Sidebar } from "@/components/layout/sidebar";
import { getProfile, requireUser } from "@/lib/data/auth";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  const { user } = await requireUser();
  const profile = await getProfile();

  return (
    <div className="flex min-h-dvh">
      <RouteProgress />
      <Sidebar displayName={profile.full_name} email={user.email ?? ""} />
      <div className="flex min-w-0 flex-1 flex-col overflow-x-clip">
        <OnlineBanner />
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 pt-5 pb-28 sm:px-6 md:pb-10 lg:px-8 lg:pt-8">
          <InstallBanner />
          {children}
        </main>
      </div>
      <MobileNav />
    </div>
  );
}
