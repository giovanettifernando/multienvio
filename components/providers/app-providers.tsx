"use client";

import "@ant-design/v5-patch-for-react-19";
import { useState, type PropsWithChildren } from "react";
import App from "antd/es/app";
import {
  QueryClient,
  QueryClientProvider,
} from "@tanstack/react-query";

export function AppProviders({ children }: PropsWithChildren) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 1000 * 60 * 5,
            refetchOnWindowFocus: false,
          },
        },
      }),
  );

  return (
    <QueryClientProvider client={queryClient}>
      <App>{children}</App>
      {/* ReactQueryDevtools disabled due to Next.js 15 compatibility issue */}
      {/* {process.env.NODE_ENV === "development" ? (
        <ReactQueryDevtools initialIsOpen={false} />
      ) : null} */}
    </QueryClientProvider>
  );
}
