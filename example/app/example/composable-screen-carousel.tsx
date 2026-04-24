import * as OnboardingUi from '@rocapine/react-native-onboarding-ui';
import { View, Pressable, Text, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';

export const unstable_settings = {
  anchor: '(tabs)',
};

export default function ComposableScreenCarouselExample() {
  const router = useRouter();

  const step = {
    id: 'composable-screen-carousel',
    type: 'ComposableScreen',
    name: 'ComposableScreen — Carousel',
    displayProgressHeader: true,
    payload: {
      elements: [
        {
          id: 'root',
          type: 'YStack',
          props: { gap: 32, padding: 24 },
          children: [
            {
              id: 'section-title',
              type: 'Text',
              props: { content: 'Carousel', fontSize: 22, fontWeight: '700', textAlign: 'center' },
            },
            {
              id: 'normal-label',
              type: 'Text',
              props: { content: 'normal', fontSize: 13, fontWeight: '600', opacity: 0.5 },
            },
            {
              id: 'carousel-normal',
              type: 'Carousel' as const,
              props: {
                carouselType: 'normal' as const,
                autoPlay: true,
                autoPlayInterval: 3000,
                loop: true,
                showDots: true,
                height: 160,
                borderRadius: 12,
              },
              children: [
                { id: 'n-slide-1', type: 'Image' as const, props: { url: 'https://picsum.photos/400/160?random=1', height: 160, resizeMode: 'cover' as const } },
                { id: 'n-slide-2', type: 'Image' as const, props: { url: 'https://picsum.photos/400/160?random=2', height: 160, resizeMode: 'cover' as const } },
                { id: 'n-slide-3', type: 'Image' as const, props: { url: 'https://picsum.photos/400/160?random=3', height: 160, resizeMode: 'cover' as const } },
              ],
            },
            {
              id: 'parallax-label',
              type: 'Text',
              props: { content: 'parallax', fontSize: 13, fontWeight: '600', opacity: 0.5 },
            },
            {
              id: 'carousel-parallax',
              type: 'Carousel' as const,
              props: {
                carouselType: 'parallax' as const,
                autoPlay: true,
                autoPlayInterval: 3500,
                loop: true,
                showDots: true,
                height: 160,
                borderRadius: 12,
              },
              children: [
                { id: 'p-slide-1', type: 'Image' as const, props: { url: 'https://picsum.photos/400/160?random=4', height: 160, resizeMode: 'cover' as const } },
                { id: 'p-slide-2', type: 'Image' as const, props: { url: 'https://picsum.photos/400/160?random=5', height: 160, resizeMode: 'cover' as const } },
                { id: 'p-slide-3', type: 'Image' as const, props: { url: 'https://picsum.photos/400/160?random=6', height: 160, resizeMode: 'cover' as const } },
              ],
            },
            {
              id: 'stack-label',
              type: 'Text',
              props: { content: 'stack', fontSize: 13, fontWeight: '600', opacity: 0.5 },
            },
            {
              id: 'carousel-stack',
              type: 'Carousel' as const,
              props: {
                carouselType: 'stack' as const,
                autoPlay: true,
                autoPlayInterval: 3000,
                loop: true,
                showDots: true,
                height: 160,
                borderRadius: 12,
              },
              children: [
                { id: 's-slide-1', type: 'Image' as const, props: { url: 'https://picsum.photos/400/160?random=7', height: 160, resizeMode: 'cover' as const } },
                { id: 's-slide-2', type: 'Image' as const, props: { url: 'https://picsum.photos/400/160?random=8', height: 160, resizeMode: 'cover' as const } },
                { id: 's-slide-3', type: 'Image' as const, props: { url: 'https://picsum.photos/400/160?random=9', height: 160, resizeMode: 'cover' as const } },
              ],
            },
            {
              id: 'left-align-label',
              type: 'Text',
              props: { content: 'left-align', fontSize: 13, fontWeight: '600', opacity: 0.5 },
            },
            {
              id: 'carousel-left-align',
              type: 'Carousel' as const,
              props: {
                carouselType: 'left-align' as const,
                autoPlay: false,
                loop: true,
                showDots: true,
                height: 160,
                borderRadius: 12,
              },
              children: [
                { id: 'la-slide-1', type: 'Image' as const, props: { url: 'https://picsum.photos/400/160?random=13', height: 160, resizeMode: 'cover' as const } },
                { id: 'la-slide-2', type: 'Image' as const, props: { url: 'https://picsum.photos/400/160?random=14', height: 160, resizeMode: 'cover' as const } },
                { id: 'la-slide-3', type: 'Image' as const, props: { url: 'https://picsum.photos/400/160?random=15', height: 160, resizeMode: 'cover' as const } },
              ],
            },
          ],
        },
      ],
    },
    customPayload: null,
    continueButtonLabel: 'Continue',
    figmaUrl: null,
  } satisfies OnboardingUi.ComposableScreenStepType;

  return (
    <View style={{ flex: 1 }}>
      <OnboardingUi.ComposableScreenRenderer step={step} onContinue={() => router.back()} />
      <Pressable style={styles.backButton} onPress={() => router.back()}>
        <Text style={styles.backButtonText}>‹</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
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
