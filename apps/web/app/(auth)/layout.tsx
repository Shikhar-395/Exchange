import { authTheme, getAuthThemeVars } from "@/lib/auth-theme";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div
      style={getAuthThemeVars(authTheme.defaultColors)}
      className="exchange-shell relative flex min-h-[calc(100vh-56px)] items-center justify-center overflow-hidden px-4"
    >
      <div className="relative z-10 flex w-full items-center justify-center py-12">
        {children}
      </div>
    </div>
  );
}
