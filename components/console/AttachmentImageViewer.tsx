import { useEffect, useMemo, useState } from 'react'
import { Image, Modal, Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Mono, Sans } from '../../design/Type'
import { useTheme } from '../../design/theme'

interface AttachmentImageViewerProps {
  visible: boolean
  imageUri: string
  imageHeaders?: Record<string, string>
  title?: string
  onClose: () => void
  onRemove?: () => void
}

export function AttachmentImageViewer({
  visible,
  imageUri,
  imageHeaders,
  title,
  onClose,
  onRemove,
}: AttachmentImageViewerProps) {
  const { c } = useTheme()
  const insets = useSafeAreaInsets()
  const viewport = useWindowDimensions()
  const [imageRatio, setImageRatio] = useState(16 / 9)
  const displayTitle = useMemo(() => attachmentDisplayTitle(title), [title])
  const fileLabel = useMemo(() => attachmentFileLabel(title), [title])
  const hasRemove = typeof onRemove === 'function'
  const footerHeight = hasRemove ? 74 + insets.bottom : Math.max(insets.bottom, 12)
  const headerHeight = insets.top + 76
  const maxImageWidth = Math.max(1, viewport.width - 32)
  const maxImageHeight = Math.max(220, viewport.height - headerHeight - footerHeight - 44)
  const fittedImage = fitImage(maxImageWidth, maxImageHeight, imageRatio)

  useEffect(() => {
    if (!imageUri) return
    setImageRatio(16 / 9)
    const onSize = (width: number, height: number) => {
      if (width > 0 && height > 0) setImageRatio(width / height)
    }
    const onError = () => {}
    if (imageHeaders && Object.keys(imageHeaders).length > 0 && 'getSizeWithHeaders' in Image) {
      Image.getSizeWithHeaders(imageUri, imageHeaders, onSize, onError)
      return
    }
    Image.getSize(imageUri, onSize, onError)
  }, [imageHeaders, imageUri])

  return (
    <Modal
      visible={visible}
      animationType="fade"
      presentationStyle="fullScreen"
      onRequestClose={onClose}
    >
      <View
        accessibilityViewIsModal
        style={[styles.screen, { backgroundColor: c.bg }]}
      >
        <View style={[styles.topBar, { paddingTop: insets.top + 8, borderBottomColor: c.border }]}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Fechar visualização da imagem"
            hitSlop={10}
            onPress={onClose}
            style={({ pressed }) => [
              styles.iconButton,
              {
                backgroundColor: pressed ? c.premium : c.surface,
                borderColor: c.border,
              },
            ]}
          >
            <Sans size={26} lineHeight={28} color={c.ink} align="center">
              ×
            </Sans>
          </Pressable>

          <View style={styles.titleBlock}>
            <Sans size={15} lineHeight={19} weight="sb" color={c.ink} numberOfLines={1} align="center">
              {displayTitle}
            </Sans>
            <Mono size={10.5} lineHeight={14} letterSpacing={0} color={c.ink2} numberOfLines={1} align="center">
              {fileLabel}
            </Mono>
          </View>

          <View style={styles.headerSide} />
        </View>

        <ScrollView
          style={styles.stage}
          contentContainerStyle={styles.stageContent}
          maximumZoomScale={4}
          minimumZoomScale={1}
          bouncesZoom
          centerContent
          showsVerticalScrollIndicator={false}
          showsHorizontalScrollIndicator={false}
        >
          <View
            style={[
              styles.imageFrame,
              {
                width: fittedImage.width,
                height: fittedImage.height,
                backgroundColor: c.pureBlack,
                borderColor: c.border,
              },
            ]}
          >
            {imageUri ? (
              <Image
                source={{ uri: imageUri, headers: imageHeaders }}
                resizeMode="contain"
                style={styles.image}
                accessible
                accessibilityLabel={fileLabel}
                accessibilityIgnoresInvertColors
                onLoad={(event) => {
                  const source = event.nativeEvent.source
                  if (source.width > 0 && source.height > 0) {
                    setImageRatio(source.width / source.height)
                  }
                }}
              />
            ) : null}
          </View>
        </ScrollView>

        {hasRemove ? (
          <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 10) + 10, borderTopColor: c.border }]}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Remover imagem anexada"
              onPress={onRemove}
              style={({ pressed }) => [
                styles.removeButton,
                {
                  backgroundColor: pressed ? c.surface : 'transparent',
                  borderColor: c.border,
                },
              ]}
            >
              <Sans size={14} lineHeight={18} weight="med" color={c.recRed} align="center">
                Remover anexo
              </Sans>
            </Pressable>
          </View>
        ) : null}
      </View>
    </Modal>
  )
}

function fitImage(maxWidth: number, maxHeight: number, ratio: number): { width: number; height: number } {
  const safeRatio = Number.isFinite(ratio) && ratio > 0 ? ratio : 1
  const widthFromMax = maxWidth
  const heightFromWidth = widthFromMax / safeRatio
  if (heightFromWidth <= maxHeight) {
    return { width: widthFromMax, height: heightFromWidth }
  }

  return { width: maxHeight * safeRatio, height: maxHeight }
}

function attachmentDisplayTitle(title?: string): string {
  if (!title) return 'Prévia'
  if (title.startsWith('atlas-clipboard-')) return 'Imagem colada'
  return 'Imagem anexada'
}

function attachmentFileLabel(title?: string): string {
  const label = title?.trim()
  if (!label) return 'arquivo local'
  const parts = label.replace(/^file:\/\//, '').split('/').filter(Boolean)
  return parts.length > 0 ? parts[parts.length - 1] : label
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  topBar: {
    minHeight: 76,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingBottom: 12,
    gap: 14,
    zIndex: 3,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerSide: {
    width: 48,
  },
  titleBlock: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  iconButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stage: {
    flex: 1,
  },
  stageContent: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingHorizontal: 16,
    paddingTop: 22,
    paddingBottom: 24,
  },
  imageFrame: {
    overflow: 'hidden',
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
  },
  image: {
    width: '100%',
    height: '100%',
  },
  footer: {
    paddingHorizontal: 18,
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  removeButton: {
    minHeight: 48,
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
})
