// src/App.tsx
import { RouterProvider } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { Toaster } from 'react-hot-toast';
import { router } from './router';
import { AuthProvider } from './components/auth/AuthProvider';
import { useSystemStore } from './store/system.store';
import { useEffect } from 'react';

// Create a client
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Data is fresh for 1 minute
      staleTime: 60 * 1000,
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

function App() {
  const fetchBranding = useSystemStore((s) => s.fetchBranding);

  useEffect(() => {
    fetchBranding();
  }, [fetchBranding]);

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <RouterProvider router={router} />
      </AuthProvider>
      <Toaster 
        position="top-right" 
        toastOptions={{ 
          duration: 4000,
          className: 'text-sm font-medium',
        }} 
      />
      {import.meta.env.DEV && <ReactQueryDevtools initialIsOpen={false} />}
    </QueryClientProvider>
  );
}

export default App;
