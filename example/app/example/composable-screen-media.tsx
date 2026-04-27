import * as OnboardingUi from '@rocapine/react-native-onboarding-ui';
import { View, Pressable, Text, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';

export const unstable_settings = {
  anchor: '(tabs)',
};

export default function ComposableScreenMediaExample() {
  const router = useRouter();

  const step = {
    id: 'composable-screen-media',
    type: 'ComposableScreen',
    name: 'ComposableScreen — Media',
    displayProgressHeader: true,
    payload: {
      elements: [
        {
          id: 'root',
          type: 'YStack',
          props: { gap: 24, padding: 24 },
          children: [
            {
              id: 'section-title',
              type: 'Text',
              props: { content: 'Media Elements', fontSize: 22, fontWeight: '700', textAlign: 'center' },
            },
            {
              id: 'hero-image',
              type: 'Image',
              props: {
                url: 'https://picsum.photos/800/400?grayscale',
                height: 180,
                resizeMode: 'cover',
                borderRadius: 16,
              },
            },
            {
              id: 'image-caption',
              type: 'Text',
              props: { content: 'Image', fontSize: 13, opacity: 0.5, textAlign: 'center' },
            },
            {
              id: 'hero-icon',
              type: 'Icon',
              props: {
                name: 'Circle',
                size: 48,
                color: '#007AFF',
                marginVertical: 4,
                alignSelf: 'center',
              },
            },
            {
              id: 'icon-caption',
              type: 'Text',
              props: { content: 'Icon', fontSize: 13, opacity: 0.5, textAlign: 'center' },
            },
            {
              id: 'hero-lottie',
              type: 'Lottie',
              props: {
                source: 'https://raw.githubusercontent.com/airbnb/lottie-web/master/demo/adrock/data.json',
                height: 180,
                autoPlay: true,
                loop: true,
              },
            },
            {
              id: 'lottie-caption',
              type: 'Text',
              props: { content: 'Lottie', fontSize: 13, opacity: 0.5, textAlign: 'center' },
            },
            {
              id: 'hero-rive',
              type: 'Rive',
              props: {
                url: 'https://cdn.rive.app/animations/vehicles.riv',
                height: 180,
                autoPlay: true,
                fit: 'Contain',
              },
            },
            {
              id: 'rive-caption',
              type: 'Text',
              props: { content: 'Rive', fontSize: 13, opacity: 0.5, textAlign: 'center' },
            },
            {
              id: 'hero-video',
              type: 'Video',
              props: {
                url: 'https://lorem.video/720p',
                height: 200,
                borderRadius: 12,
                controls: false,
                muted: true,
                autoPlay: true,
              },
            },
            {
              id: 'video-caption',
              type: 'Text',
              props: { content: 'Video', fontSize: 13, opacity: 0.5, textAlign: 'center' },
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
