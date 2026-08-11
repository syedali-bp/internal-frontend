import { StatusBar } from 'expo-status-bar'
import { SafeAreaProvider } from 'react-native-safe-area-context'

import { AddProductScreen } from './src/features/product/AddProductScreen'

export default function App() {
  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      <AddProductScreen />
    </SafeAreaProvider>
  )
}
