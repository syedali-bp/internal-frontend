import { useState } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { SafeAreaView as SafeAreaScreen } from 'react-native-safe-area-context'
import { CameraView, useCameraPermissions } from 'expo-camera'

import { BarcodeIcon, ProductDetailsIcon } from '../../components'
import { colors } from '../../theme/colors'

type ScanQrScreenProps = {
  onScanned: (barcode: string) => void
  onAddProductDetails: () => void
}

/**
 * Barcode scanning is optional. Users can scan a code or begin a product
 * draft without one.
 */
export function ScanQrScreen({ onScanned, onAddProductDetails }: ScanQrScreenProps) {
  const [permission, requestPermission] = useCameraPermissions()
  const [hasScanned, setHasScanned] = useState(false)
  const [isScanning, setIsScanning] = useState(false)

  const startScanning = async () => {
    if (!permission?.granted) {
      const result = await requestPermission()
      if (!result.granted) return
    }
    setHasScanned(false)
    setIsScanning(true)
  }

  const handleBarcodeScanned = ({ data }: { data: string }) => {
    if (hasScanned) return
    setHasScanned(true)
    onScanned(data.trim())
  }

  return (
    isScanning ? (
      <View style={s.cameraScreen}>
        <CameraView
          style={s.camera}
          facing="back"
          barcodeScannerSettings={{ barcodeTypes: ['qr', 'ean13', 'ean8', 'upc_a', 'upc_e', 'code128'] }}
          onBarcodeScanned={handleBarcodeScanned}
        />
        <View pointerEvents="none" style={s.scanGuide}>
          <View style={s.scanGuideIcon}>
            <BarcodeIcon color={colors.onAccent} size={84} />
          </View>
          <Text style={s.scanGuideText}>Align barcode within the frame</Text>
        </View>
        <Pressable style={s.cancelButton} onPress={() => setIsScanning(false)}>
          <Text style={s.cancelButtonText}>Cancel Scan</Text>
        </Pressable>
      </View>
    ) : (
      <SafeAreaScreen style={s.screen} edges={['top', 'left', 'right']}>
        <View style={s.hero}>
          <Text style={s.title}>Add Product</Text>
          <Text style={s.subtitle}>
            Scan a barcode when one is available, or add the product details manually.
          </Text>
        </View>
        <View style={s.card}>
          <Pressable style={s.button} onPress={startScanning}>
            <BarcodeIcon size={38} />
            <Text style={s.buttonText}>Scan Barcode</Text>
          </Pressable>
          <Pressable style={s.secondaryButton} onPress={onAddProductDetails}>
            <ProductDetailsIcon />
            <Text style={s.secondaryButtonText}>Add Product Details</Text>
          </Pressable>
        </View>
      </SafeAreaScreen>
    )
  )
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.screen, padding: 16 },
  cameraScreen: { flex: 1, backgroundColor: '#000' },
  hero: { marginBottom: 16 },
  title: { fontSize: 28, fontWeight: '800', color: colors.text, marginBottom: 6 },
  subtitle: { fontSize: 14, color: colors.textMuted, lineHeight: 20 },
  camera: { flex: 1 },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  button: {
    backgroundColor: colors.primary,
    borderRadius: 10,
    minHeight: 114,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: { color: colors.onAccent, fontSize: 15, fontWeight: '800', marginTop: 8 },
  secondaryButton: {
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: 10,
    minHeight: 114,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
  },
  secondaryButtonText: { color: colors.primary, fontSize: 15, fontWeight: '800', marginTop: 8 },
  cancelButton: {
    position: 'absolute',
    bottom: 48,
    alignSelf: 'center',
    backgroundColor: colors.surface,
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  cancelButtonText: { color: colors.primary, fontWeight: '800' },
  scanGuide: {
    alignItems: 'center',
    justifyContent: 'center',
    left: 0,
    position: 'absolute',
    right: 0,
    top: '42%',
  },
  scanGuideIcon: {
    alignItems: 'center',
    borderColor: colors.onAccent,
    borderRadius: 18,
    borderWidth: 2,
    height: 160,
    justifyContent: 'center',
    width: 260,
  },
  scanGuideText: { color: colors.onAccent, fontSize: 14, fontWeight: '700', marginTop: 14 },
})
