import { useCallback, useEffect, useMemo, useRef, useState, type MutableRefObject } from 'react'
import {
  Image,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native'
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context'
import { useLocalSearchParams, useRouter } from 'expo-router'
import * as Haptics from 'expo-haptics'
import * as ImagePicker from 'expo-image-picker'
import * as Location from 'expo-location'
import {
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioRecorder,
  useAudioRecorderState,
} from 'expo-audio'
import { CapturePulse } from '../components/CapturePulse'
import { CaptureCounter } from '../components/CaptureCounter'
import { CaptureWave } from '../components/CaptureWave'
import { CaptureStatus } from '../components/capture/CaptureStatus'
import { Frau, Sans } from '../design/Type'
import { useTheme } from '../design/theme'
import { fonts } from '../design/tokens'
import { useShell } from '../components/AtlasShell'
import { useOverlays, type CaptureMode, type CaptureSensitivity } from '../lib/overlays'
import type { DomainKey } from '../lib/domains'
import { useAtlasStore } from '../lib/atlasStore'
import { inferAtlasDecide } from '../lib/atlasDecide'
import { useFocusSuppression } from '../lib/hooks/useFocusSuppression'

export default function CaptureScreen() {
  const { c, name } = useTheme()
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const params = useLocalSearchParams<{ mode?: string }>()
  const { pulseSync, showToast } = useShell()
  const openMic = useOverlays((s) => s.openMic)
  const openDomain = useOverlays((s) => s.openDomain)
  const openCaptureSettings = useOverlays((s) => s.openCaptureSettings)
  const createAudioCapture = useAtlasStore((s) => s.createAudioCapture)
  const createTextCapture = useAtlasStore((s) => s.createTextCapture)
  const createPhotoCapture = useAtlasStore((s) => s.createPhotoCapture)
  const domains = useAtlasStore((s) => s.domains)
  const refreshDomains = useAtlasStore((s) => s.refreshDomains)
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY)
  const recorderState = useAudioRecorderState(recorder, 150)
  const recordingRef = useRef(false)
  const initialMode: CaptureMode =
    params.mode === 'text' || params.mode === 'photo' ? params.mode : 'audio'
  const [mode, setMode] = useState<CaptureMode>(initialMode)
  // Default 'outro' (the catch-all) — domain is asked at save time, not here.
  const [domain, setDomain] = useState<DomainKey>('outro')
  const [sensitivity, setSensitivity] = useState<CaptureSensitivity>('normal')
  const [text, setText] = useState('')
  const [photo, setPhoto] = useState<ImagePicker.ImagePickerAsset | null>(null)
  const textScrollRef = useRef<ScrollView>(null)
  const textInputRef = useRef<TextInput>(null)
  const lastTextHeightRef = useRef(0)
  const { editable: textEditable, suppress: suppressTextFocus } = useFocusSuppression()
  const textInputStyle = useMemo(() => [styles.textInput, { color: c.ink }], [c.ink])
  const onTextContentSizeChange = useCallback(
    (e: { nativeEvent: { contentSize: { height: number } } }) => {
      const h = e.nativeEvent.contentSize.height
      if (h > lastTextHeightRef.current + 1) {
        requestAnimationFrame(() =>
          textScrollRef.current?.scrollToEnd({ animated: true }),
        )
      }
      lastTextHeightRef.current = h
    },
    [],
  )
  const onTextScrollBeginDrag = useCallback(() => {
    textInputRef.current?.blur()
    Keyboard.dismiss()
    suppressTextFocus()
  }, [suppressTextFocus])
  const [starting, setStarting] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    void refreshDomains()
  }, [refreshDomains])

  useEffect(() => {
    if (mode !== 'text') return
    const t = setTimeout(() => textInputRef.current?.focus(), 60)
    return () => clearTimeout(t)
  }, [mode])

  useEffect(() => {
    const selected = domains.find((d) => d.key === domain)
    if (!selected) {
      // Fallback prefers 'outro' (the catch-all), then last domain in the list.
      const fallback = domains.find((d) => d.key === 'outro') ?? domains[domains.length - 1]
      if (fallback) setDomain(fallback.key)
      return
    }
    if (selected.defaultSensitivity === 'sensitive') setSensitivity('sensitive')
    if (selected.defaultSensitivity === 'private' && sensitivity === 'normal') setSensitivity('private')
  }, [domain, domains, sensitivity])

  useEffect(() => {
    let mounted = true

    async function startRecording() {
      if (mode !== 'audio') {
        setStarting(false)
        return
      }

      setStarting(true)
      setError(null)

      try {
        const permission = await requestRecordingPermissionsAsync()
        if (!permission.granted) {
          openMic()
          // v18: rota `/` virou Atlas AI; "voltar pra home antiga" agora é /edicao
          // (exemplar editorial · agenda/operação/tecido/portas).
          router.replace('/edicao')
          return
        }

        await setAudioModeAsync({
          allowsRecording: true,
          playsInSilentMode: true,
        })
        await recorder.prepareToRecordAsync()
        if (!mounted) return

        recorder.record()
        recordingRef.current = true
        setStarting(false)
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
      } catch (recordingError) {
        if (!mounted) return
        setError(recordingError instanceof Error ? recordingError.message : 'Não foi possível iniciar a gravação.')
        setStarting(false)
      }
    }

    void startRecording()

    return () => {
      mounted = false
      void stopRecorderSafely(recorder, recordingRef)
    }
  }, [mode, openMic, recorder, router])

  // Always ask for domain at save — pre-selected via Atlas Decide heurística
  // client-side (`inferAtlasDecide`) quando há texto. Default 'outro' faz o
  // prompt safe-to-skip; com Atlas Decide, abre já com domínio sugerido +
  // destino editorial pré-marcado.
  const promptDomainAndSave = (
    saver: (chosen: DomainKey, chosenSensitivity: CaptureSensitivity) => Promise<void>,
    options?: { text?: string | null; domainHint?: DomainKey | null },
  ) => {
    const decided = options
      ? inferAtlasDecide({ text: options.text, domain: options.domainHint })
      : null
    const prePicked = decided
      ? { domain: decided.domain, destino: decided.destino }
      : null
    openDomain(
      (picked) => {
        const finalDomain = picked ?? prePicked?.domain ?? 'outro'
        const finalSensitivity = sensitivityForSave(finalDomain, domains, sensitivity)
        void saver(finalDomain, finalSensitivity)
      },
      undefined,
      prePicked,
    )
  }

  const handleSaveAudio = () => {
    if (saving || starting) return
    const durationMs = recorderState.durationMillis
    // Áudio sem transcrição local · Atlas Decide pega via clarifyCapture
    // pós-criação (não há texto pra heurística agora).
    promptDomainAndSave(async (chosenDomain, chosenSensitivity) => {
      setSaving(true)
      setError(null)

      try {
        if (recordingRef.current || recorderState.isRecording) {
          recordingRef.current = false
          await recorder.stop()
        }

        const fileUri = safeRecorderUri(recorder) ?? recorderState.url
        if (!fileUri) {
          throw new Error('Gravação não gerou arquivo local.')
        }

        const location = await getOptionalLocation()
        await createAudioCapture({
          domain: chosenDomain,
          fileUri,
          durationMs,
          capturedLat: location.lat,
          capturedLng: location.lng,
          metadata: captureMetadata('audio', chosenDomain, chosenSensitivity, location.metadata),
        })

        finish('Áudio capturado')
      } catch (captureError) {
        setError(captureError instanceof Error ? captureError.message : 'Falha ao salvar captura.')
        setSaving(false)
      }
    })
  }

  const handleSaveText = () => {
    const body = text.trim()
    if (saving) return
    if (!body) {
      setError('Escreva o pensamento antes de salvar.')
      return
    }
    // Atlas Decide heurística client-side com o texto · pre-populate
    // domain + destino sugeridos no DomainSheet.
    promptDomainAndSave(async (chosenDomain, chosenSensitivity) => {
      setSaving(true)
      setError(null)

      try {
        const location = await getOptionalLocation()
        await createTextCapture({
          domain: chosenDomain,
          text: body,
          capturedLat: location.lat,
          capturedLng: location.lng,
          metadata: captureMetadata('text', chosenDomain, chosenSensitivity, location.metadata),
        })

        finish('Texto capturado')
      } catch (captureError) {
        setError(captureError instanceof Error ? captureError.message : 'Falha ao salvar captura.')
        setSaving(false)
      }
    }, { text: body })
  }

  const pickPhoto = async () => {
    if (saving) return
    setError(null)

    try {
      const permission = await ImagePicker.requestCameraPermissionsAsync()
      if (!permission.granted) {
        setError('Permissão de câmera negada.')
        return
      }

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.86,
        exif: false,
      })

      if (!result.canceled) {
        setPhoto(result.assets[0] ?? null)
      }
    } catch (photoError) {
      setError(photoError instanceof Error ? photoError.message : 'Não foi possível abrir a câmera.')
    }
  }

  const handleSavePhoto = async () => {
    if (saving) return
    if (!photo?.uri) {
      await pickPhoto()
      return
    }
    promptDomainAndSave(async (chosenDomain, chosenSensitivity) => {
      setSaving(true)
      setError(null)

      try {
        const location = await getOptionalLocation()
        await createPhotoCapture({
          domain: chosenDomain,
          fileUri: photo.uri,
          mimeType: photo.mimeType ?? 'image/jpeg',
          capturedLat: location.lat,
          capturedLng: location.lng,
          metadata: captureMetadata('photo', chosenDomain, chosenSensitivity, {
            ...location.metadata,
            photo_width: photo.width,
            photo_height: photo.height,
          }),
        })

        finish('Foto capturada')
      } catch (captureError) {
        setError(captureError instanceof Error ? captureError.message : 'Falha ao salvar captura.')
        setSaving(false)
      }
    })
  }

  const finish = (message: string) => {
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
    showToast(message)
    pulseSync(2000)
    router.replace('/inbox')
  }

  const openSettings = () => {
    openCaptureSettings({ mode, domain, sensitivity }, (next) => {
      if (next.mode && next.mode !== mode) {
        setMode(next.mode)
        setError(null)
      }
      if (next.domain && next.domain !== domain) setDomain(next.domain)
      if (next.sensitivity && next.sensitivity !== sensitivity) setSensitivity(next.sensitivity)
    })
  }

  return (
    <View style={[styles.fill, { backgroundColor: c.bg }]}>
      <SafeAreaView edges={['top']} style={styles.fill}>
        <KeyboardAvoidingView
          style={styles.fill}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={styles.header}>
            <CaptureStatus
              mode={mode}
              sensitivity={sensitivity}
              onPress={openSettings}
            />
          </View>

          <View style={styles.stage}>
            {mode === 'audio' ? (
              <View style={styles.audioStage}>
                <CapturePulse />
                <CaptureCounter running={recorderState.isRecording && !saving} />
                <Frau italic size={18} lineHeight={26} color={c.ink2} style={styles.stageCopy}>
                  {starting ? 'Preparando microfone…' : saving ? 'Salvando captura…' : 'Fale o que está pensando. Atlas escuta.'}
                </Frau>
                <CaptureWave />
              </View>
            ) : mode === 'text' ? (
              <ScrollView
                ref={textScrollRef}
                style={styles.fill}
                contentContainerStyle={styles.textScrollContent}
                keyboardShouldPersistTaps="handled"
                keyboardDismissMode="on-drag"
                showsVerticalScrollIndicator={false}
                onScrollBeginDrag={onTextScrollBeginDrag}
              >
                <TextInput
                  ref={textInputRef}
                  value={text}
                  onChangeText={setText}
                  placeholder="Escreva sem lapidar. A curadoria vem depois."
                  placeholderTextColor={c.ink3}
                  selectionColor={c.ink}
                  multiline
                  editable={textEditable}
                  scrollEnabled={false}
                  textAlignVertical="top"
                  style={textInputStyle}
                  onContentSizeChange={onTextContentSizeChange}
                />
              </ScrollView>
            ) : (
              <View style={styles.photoStage}>
                {photo?.uri ? (
                  <Image source={{ uri: photo.uri }} style={styles.photoPreview} />
                ) : (
                  <View style={styles.photoEmpty}>
                    <Frau italic size={16} lineHeight={24} color={c.ink2}>
                      nenhuma foto ainda.
                    </Frau>
                  </View>
                )}
                <Pressable
                  onPress={pickPhoto}
                  hitSlop={8}
                  style={({ pressed }) => [styles.photoLink, { opacity: pressed ? 0.6 : 1 }]}
                >
                  <Frau italic size={14} lineHeight={20} color={c.ink} style={{ opacity: 0.6 }}>
                    {photo ? 'trocar foto' : 'abrir câmera'}
                  </Frau>
                </Pressable>
              </View>
            )}
          </View>

          {error ? (
            <View style={styles.errorRow}>
              <Frau italic size={13} lineHeight={18} color={c.recRed}>
                {error}
              </Frau>
            </View>
          ) : null}

          <View
            style={[
              styles.footer,
              mode === 'audio' ? styles.footerCenter : styles.footerEnd,
              { paddingBottom: Math.max(20, insets.bottom + 8) },
            ]}
          >
            {mode === 'audio' ? (
              <Pressable
                onPress={handleSaveAudio}
                disabled={saving || starting}
                style={({ pressed }) => [
                  styles.stopButton,
                  {
                    backgroundColor: c.ink,
                    opacity: saving || starting ? 0.45 : 1,
                    transform: [{ scale: pressed ? 0.94 : 1 }],
                    shadowColor: name === 'dark' ? '#000' : '#1C1916',
                  },
                ]}
              >
                <View style={[styles.stopInner, { backgroundColor: c.bg }]} />
              </Pressable>
            ) : (
              <Pressable
                onPress={mode === 'text' ? handleSaveText : handleSavePhoto}
                disabled={saving}
                style={({ pressed }) => [
                  styles.saveButton,
                  {
                    backgroundColor: c.ink,
                    opacity: saving ? 0.45 : 1,
                    transform: [{ scale: pressed ? 0.97 : 1 }],
                    shadowColor: name === 'dark' ? '#000' : '#1C1916',
                  },
                ]}
              >
                <Sans weight="med" size={14} color={c.onInk}>
                  {saving ? 'salvando…' : 'salvar'}
                </Sans>
              </Pressable>
            )}
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  )
}

// When the operator picks a domain at save time, honor that domain's
// `defaultSensitivity` if it has one — picking 'atlas' should commit as
// private even if the screen-level sensitivity was still 'normal'.
function sensitivityForSave(
  pickedDomain: DomainKey,
  allDomains: Array<{ key: string; defaultSensitivity?: string | null }>,
  current: CaptureSensitivity,
): CaptureSensitivity {
  const def = allDomains.find((d) => d.key === pickedDomain)?.defaultSensitivity
  if (def === 'private' || def === 'sensitive') return def
  return current
}

function safeRecorderUri(recorder: ReturnType<typeof useAudioRecorder>): string | null {
  try {
    return recorder.uri
  } catch {
    return null
  }
}

async function stopRecorderSafely(
  recorder: ReturnType<typeof useAudioRecorder>,
  recordingRef: MutableRefObject<boolean>,
): Promise<void> {
  if (recordingRef.current) {
    recordingRef.current = false
    try {
      await recorder.stop()
    } catch {
      // expo-audio can invalidate the native shared object during unmount or mode switches.
    }
  }
  await setAudioModeAsync({ allowsRecording: false }).catch(() => {})
}

function captureMetadata(
  mode: CaptureMode,
  domain: DomainKey,
  sensitivity: CaptureSensitivity,
  extra: Record<string, unknown>,
): Record<string, unknown> {
  return {
    ...extra,
    capture_surface_version: 'premium-p6',
    input_mode: mode,
    sensitivity,
    privacy: {
      domain,
      sensitivity,
      external_ai_allowed: sensitivity === 'normal',
      selected_by: 'operator',
    },
  }
}

async function getOptionalLocation(): Promise<{
  lat: number | null
  lng: number | null
  metadata: Record<string, unknown>
}> {
  try {
    const permission = await Location.requestForegroundPermissionsAsync()
    if (!permission.granted) {
      return { lat: null, lng: null, metadata: { location_permission: 'denied' } }
    }

    const lastKnown = await Location.getLastKnownPositionAsync({
      maxAge: 5 * 60 * 1000,
      requiredAccuracy: 500,
    })
    const position = lastKnown ?? await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced,
    })

    return {
      lat: position.coords.latitude,
      lng: position.coords.longitude,
      metadata: {
        location_accuracy_m: position.coords.accuracy,
        location_source: lastKnown ? 'last_known' : 'current',
      },
    }
  } catch (locationError) {
    return {
      lat: null,
      lng: null,
      metadata: {
        location_error: locationError instanceof Error ? locationError.message : 'unknown',
      },
    }
  }
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  header: {
    paddingTop: 4,
    paddingHorizontal: 28,
    paddingBottom: 8,
  },
  stage: {
    flex: 1,
    paddingHorizontal: 28,
    paddingTop: 12,
  },
  audioStage: {
    flex: 1,
    alignItems: 'flex-start',
    justifyContent: 'flex-start',
  },
  stageCopy: {
    maxWidth: 280,
    marginTop: 18,
  },
  textInput: {
    fontFamily: fonts.sans,
    fontSize: 20,
    lineHeight: 30,
    padding: 0,
    minHeight: 120,
  },
  textScrollContent: {
    flexGrow: 1,
    paddingBottom: 40,
  },
  photoStage: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 18,
  },
  photoEmpty: {
    width: '100%',
    minHeight: 220,
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoPreview: {
    width: '100%',
    height: 260,
    borderRadius: 10,
    backgroundColor: '#111',
  },
  photoLink: {
    paddingVertical: 8,
  },
  errorRow: {
    paddingHorizontal: 28,
    paddingTop: 6,
  },
  footer: {
    paddingHorizontal: 28,
    paddingTop: 14,
  },
  footerEnd: { alignItems: 'flex-end' },
  footerCenter: { alignItems: 'center' },
  stopButton: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.22,
    shadowRadius: 16,
    elevation: 6,
  },
  stopInner: {
    width: 22,
    height: 22,
    borderRadius: 4,
  },
  saveButton: {
    minHeight: 44,
    paddingHorizontal: 26,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.18,
    shadowRadius: 12,
    elevation: 4,
  },
})
