"use client";

import { registerLicense } from "@syncfusion/ej2-base";
import { SessionProvider } from "next-auth/react";
import { ThemeProvider } from "next-themes";

const syncfusionKey = process.env.NEXT_PUBLIC_SYNCFUSION_LICENSE_KEY;
if (syncfusionKey) {
  registerLicense(syncfusionKey);
}

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
        {children}
      </ThemeProvider>
    </SessionProvider>
  );
}
