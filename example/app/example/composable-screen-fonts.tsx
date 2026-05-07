import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { FontLoaderGate, type FontsManifest } from '@rocapine/react-native-onboarding';
import * as OnboardingUi from '@rocapine/react-native-onboarding-ui';

export const unstable_settings = {
  anchor: '(tabs)',
};

const fonts: FontsManifest = {
  Inter: {
    regular: 'https://cdn.jsdelivr.net/fontsource/fonts/inter@latest/latin-400-normal.ttf',
    medium: 'https://cdn.jsdelivr.net/fontsource/fonts/inter@latest/latin-500-normal.ttf',
    bold: 'https://cdn.jsdelivr.net/fontsource/fonts/inter@latest/latin-700-normal.ttf',
  },
  Lobster: {
    regular: 'https://cdn.jsdelivr.net/fontsource/fonts/lobster@latest/latin-400-normal.ttf',
  },
};

export default function ComposableScreenFontsExample() {
  const router = useRouter();

  const step = {
    id: 'composable-screen-fonts',
    type: 'ComposableScreen',
    name: 'Runtime Fonts',
    displayProgressHeader: false,
    payload: {
      elements: [
        {
          id: 'safe-root',
          type: 'SafeAreaView' as const,
          props: { flex: 1, edges: ['top', 'bottom'] as ('top' | 'right' | 'bottom' | 'left')[] },
          children: [
            {
              id: 'root',
              type: 'YStack' as const,
              props: { gap: 20, padding: 24, flex: 1, justifyContent: 'center' as const },
              children: [
                {
                  id: 'display',
                  type: 'Text' as const,
                  props: {
                    content: 'Lobster',
                    fontFamily: 'Lobster',
                    fontSize: 56,
                    textAlign: 'center' as const,
                  },
                },
                {
                  id: 'caption',
                  type: 'Text' as const,
                  props: {
                    content: 'Downloaded at runtime via expo-font',
                    fontFamily: 'Inter',
                    fontWeight: '400',
                    fontSize: 14,
                    textAlign: 'center' as const,
                    opacity: 0.6,
                  },
                },
                {
                  id: 'divider',
                  type: 'YStack' as const,
                  props: { height: 24 },
                  children: [],
                },
                {
                  id: 'inter-regular',
                  type: 'Text' as const,
                  props: {
                    content: 'Inter Regular (400) — quick brown fox',
                    fontFamily: 'Inter',
                    fontWeight: '400',
                    fontSize: 18,
                    textAlign: 'center' as const,
                  },
                },
                {
                  id: 'inter-medium',
                  type: 'Text' as const,
                  props: {
                    content: 'Inter Medium (500) — quick brown fox',
                    fontFamily: 'Inter',
                    fontWeight: '500',
                    fontSize: 18,
                    textAlign: 'center' as const,
                  },
                },
                {
                  id: 'inter-bold',
                  type: 'Text' as const,
                  props: {
                    content: 'Inter Bold (700) — quick brown fox',
                    fontFamily: 'Inter',
                    fontWeight: '700',
                    fontSize: 18,
                    textAlign: 'center' as const,
                  },
                },
                {
                  id: 'inter-fallback',
                  type: 'Text' as const,
                  props: {
                    content: 'Inter Light (300) — falls back to Regular (closest weight)',
                    fontFamily: 'Inter',
                    fontWeight: '300',
                    fontSize: 14,
                    textAlign: 'center' as const,
                    opacity: 0.6,
                  },
                },
                {
                  id: 'inherit-implicit',
                  type: 'Text' as const,
                  props: {
                    content: 'Inherits default font (fontFamily omitted)',
                    fontSize: 16,
                    textAlign: 'center' as const,
                  },
                },
                {
                  id: 'inherit-explicit',
                  type: 'Text' as const,
                  props: {
                    content: 'Inherits default font (fontFamily: "inherit")',
                    fontFamily: 'inherit',
                    fontSize: 16,
                    textAlign: 'center' as const,
                  },
                },
                {
                  id: 'cta',
                  type: 'Button' as const,
                  props: {
                    label: 'Done',
                    actions: ['continue' as const],
                    fontFamily: 'Inter',
                    fontWeight: '700',
                    marginVertical: 24,
                  },
                },
              ],
            },
          ],
        },
      ],
    },
    customPayload: null,
    continueButtonLabel: 'Done',
    figmaUrl: null,
  } satisfies OnboardingUi.ComposableScreenStepType;

  return (
    <View style={{ flex: 1 }}>
      <FontLoaderGate fonts={fonts} fallback={<LoadingFallback />}>
        <OnboardingUi.ComposableScreenRenderer step={step} onContinue={() => router.back()} />
      </FontLoaderGate>
      <Pressable style={styles.backButton} onPress={() => router.back()}>
        <Text style={styles.backButtonText}>‹</Text>
      </Pressable>
    </View>
  );
}

const LoadingFallback = () => (
  <View style={styles.loading}>
    <ActivityIndicator size="large" />
    <Text style={styles.loadingText}>Downloading fonts…</Text>
  </View>
);

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  loadingText: {
    fontSize: 14,
    color: '#666',
  },
  backButton: {
    position: 'absolute',
    top: 50,
    left: 20,
    width: 32,
    height: 32,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  backButtonText: {
    color: '#007AFF',
    fontSize: 32,
    fontWeight: '400',
    lineHeight: 32,
  },
});
