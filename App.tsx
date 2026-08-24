import { useState } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { StatusBar } from 'expo-status-bar'

import { ScanQrScreen } from './src/features/product/ScanQrScreen'
import { AddProductScreen } from './src/features/product/AddProductScreen'
import { ReviewProductsScreen } from './src/features/product/ReviewProductsScreen'
import type { SubmissionPayload } from './src/types/product'

type Route =
  | { name: 'scan' }
  | { name: 'add'; barcode?: string }
  | { name: 'review'; payload: SubmissionPayload }

export default function App() {
  const [route, setRoute] = useState<Route>({ name: 'scan' })
  // Reference-data failures have to surface quickly. The default three retries
  // with backoff, on top of each request's own 8s deadline, would leave the form
  // in a loading state for well over half a minute before saying anything.
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: { queries: { retry: 1 } },
      }),
  )

  return (
    <QueryClientProvider client={queryClient}>
      <SafeAreaProvider>
        <StatusBar style="light" />
        {route.name === 'scan' ? (
        <ScanQrScreen
          onScanned={(barcode) => setRoute({ name: 'add', barcode })}
          onAddProductDetails={() => setRoute({ name: 'add' })}
        />
      ) : route.name === 'add' ? (
        <AddProductScreen
          barcode={route.barcode}
          onBack={() => setRoute({ name: 'scan' })}
          onSubmitted={(payload) => setRoute({ name: 'review', payload })}
        />
      ) : (
        <ReviewProductsScreen
          item={route.payload}
          // Capture is finished and filed, so going back starts a new one
          // rather than reopening a form whose submission is already in review.
          onBack={() => setRoute({ name: 'scan' })}
          onDone={() => setRoute({ name: 'scan' })}
        />
      )}
    </SafeAreaProvider>
    </QueryClientProvider>
  )
}
