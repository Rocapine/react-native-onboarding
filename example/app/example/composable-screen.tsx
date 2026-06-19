import * as OnboardingUi from '@rocapine/react-native-onboarding-ui';
import { View, Pressable, Text, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';

export const unstable_settings = {
  anchor: '(tabs)',
};

export default function ComposableScreenExample() {
  const router = useRouter();

  const step = {
    id: 'composable-screen-1',
    type: 'ComposableScreen',
    name: 'ComposableScreen',
    displayProgressHeader: true,
    payload: {
      elements: [
        {
          id: 'safe-root',
          type: 'SafeAreaView' as const,
          props: { flex: 1, edges: ['top', 'bottom'] as ('top' | 'right' | 'bottom' | 'left')[] },
          children: [
        {
          id: 'scroll-root',
          type: 'ScrollView' as const,
          props: { flex: 1, showsVerticalScrollIndicator: false },
          children: [
        {
          id: 'root',
          type: 'YStack',
          props: { gap: 24, padding: 24 },
          children: [
            // Lottie animation
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
            // Rive animation — width:100% + aspectRatio scales to artboard
            {
              id: 'hero-rive',
              type: 'Rive',
              props: {
                url: 'https://cdn.rive.app/animations/vehicles.riv',
                width: '100%',
                aspectRatio: 16 / 9,
                autoPlay: true,
                fit: 'FitWidth',
              },
            },
            // Hero image — fade/slide in on mount (reanimated entering builder)
            {
              id: 'hero-image',
              type: 'Image',
              props: {
                url: 'https://picsum.photos/800/400?grayscale',
                height: 180,
                resizeMode: 'cover',
                borderRadius: 16,
                animation: {
                  entering: { preset: 'FadeInDown' as const, duration: 500, delay: 100, easing: 'ease-out' as const },
                },
                // Generic onPress — any non-pressable element can dispatch the same
                // action list as Button. Tapping the hero records a flag and toggles
                // "hero" into the `favorites` multi-select (arrayOp) — same JSON-array
                // encoding as CheckboxGroup, no widget needed.
                onPress: [
                  { type: 'setVariable' as const, name: 'hero_tapped', value: 'true', kind: 'string' as const },
                  { type: 'setVariable' as const, name: 'favorites', value: 'hero', label: 'Hero', arrayOp: 'toggle' as const },
                ],
              },
            },
            // SVG image — rendered via react-native-svg SvgUri (URL ends in .svg)
            {
              id: 'svg-demo',
              type: 'Image' as const,
              props: {
                url: 'https://upload.wikimedia.org/wikipedia/commons/0/02/SVG_logo.svg',
                width: 80,
                height: 80,
                resizeMode: 'contain' as const,
              },
            },
            // WebP image — rendered via expo-image
            {
              id: 'webp-demo',
              type: 'Image' as const,
              props: {
                url: 'https://www.gstatic.com/webp/gallery/1.webp',
                width: '100%',
                aspectRatio: 1.5,
                resizeMode: 'cover' as const,
                borderRadius: 12,
              },
            },
            // Second WebP image (landscape) — also via expo-image
            {
              id: 'webp-demo-2',
              type: 'Image' as const,
              props: {
                url: 'https://www.gstatic.com/webp/gallery/4.webp',
                width: '100%',
                aspectRatio: 16 / 9,
                resizeMode: 'cover' as const,
                borderRadius: 12,
                marginVertical: 8,
              },
            },
            // Icon element (filled) — static tilt + continuous breathing pulse
            {
              id: 'hero-icon',
              type: 'Icon',
              props: {
                name: 'Star',
                size: 48,
                color: '#007AFF',
                fill: '#007AFF',
                fillOpacity: 0.25,
                marginVertical: 8,
                transform: { rotate: -8 },
                animation: {
                  entering: { preset: 'ZoomIn' as const, duration: 400, spring: { damping: 10, stiffness: 160 } },
                  effect: { preset: 'pulse' as const, duration: 1200, minScale: 0.92, maxScale: 1.08 },
                },
              },
            },
            // Progress indicators — linear (autoplay loop) + circular (autoplay once)
            {
              id: 'progress-linear',
              type: 'ProgressIndicator',
              props: {
                variant: 'linear' as const,
                autoplay: true,
                loop: true,
                initialValue: 0,
                duration: 2500,
                easing: 'ease-in-out' as const,
                thickness: 10,
                showLabel: true,
                marginVertical: 8,
              },
            },
            {
              id: 'progress-circular',
              type: 'ProgressIndicator',
              props: {
                variant: 'circular' as const,
                autoplay: true,
                loop: false,
                initialValue: 0,
                duration: 1800,
                delay: 500,
                easing: 'ease-out' as const,
                size: 120,
                thickness: 12,
                showLabel: true,
                alignSelf: 'center' as const,
              },
            },
            // Count-up: animates a real value 0 -> 5000 (minValue/maxValue),
            // snapping by step (100 hops). Writes `membersJoined`; Text reads it.
            {
              id: 'progress-countup',
              type: 'ProgressIndicator',
              props: {
                variant: 'linear' as const,
                autoplay: true,
                loop: false,
                minValue: 0,
                maxValue: 5000,
                step: 50,
                variableName: 'membersJoined',
                duration: 2000,
                easing: 'ease-out' as const,
                thickness: 8,
                showLabel: false,
                marginVertical: 8,
              },
            },
            {
              id: 'progress-countup-text',
              type: 'Text',
              props: {
                content: '{{membersJoined}} members joined',
                mode: 'expression' as const,
                fontSize: 18,
                textAlign: 'center' as const,
                marginVertical: 4,
              },
            },
            // AnimatedText — count-up animated on the UI thread (native TextInput),
            // zero re-renders, no variable write. Performant counterpart above.
            {
              id: 'animated-countup',
              type: 'AnimatedText' as const,
              props: {
                from: 0,
                to: 1028709,
                duration: 2500,
                easing: 'ease-out' as const,
                thousandsSeparator: ',',
                fontSize: 28,
                fontWeight: '700' as const,
                textAlign: 'center' as const,
                marginVertical: 4,
              },
            },
            // Video element
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
                contentFit: 'cover' as const,
              },
            },
            // Input wrapped in a KeyboardAvoidingView so the keyboard doesn't hide it.
            {
              id: 'kav-input',
              type: 'KeyboardAvoidingView' as const,
              props: { keyboardVerticalOffset: 24 },
              children: [
                {
                  id: 'hero-input',
                  type: 'Input' as const,
                  props: {
                    variableName: 'name',
                    placeholder: 'Enter your name',
                    keyboardType: 'default' as const,
                    returnKeyType: 'done' as const,
                    autoCapitalize: 'words' as const,
                    autoFocus: true,
                    borderRadius: 12,
                    marginVertical: 8,
                  },
                },
              ],
            },
            // Only shown once `name` has a non-empty value — demonstrates the
            // unary `is_not_empty` condition operator.
            {
              id: 'name-greeting',
              type: 'Text' as const,
              renderWhen: { variable: 'name', operator: 'is_not_empty' as const },
              props: {
                content: 'Nice to meet you, {{name}}!',
                mode: 'expression' as const,
                fontSize: 14,
                textAlign: 'center' as const,
                opacity: 0.7,
                marginVertical: 4,
              },
            },
            // Inline rich text — `content` as styled spans. Each span inherits
            // the parent Text style and overrides only what it sets.
            {
              id: 'richtext-demo',
              type: 'Text' as const,
              props: {
                content: [
                  { text: 'Lose ' },
                  { text: '5kg', fontWeight: '700', color: '#E11D48' },
                  { text: ' in 30 days — ' },
                  {
                    text: 'guaranteed',
                    fontStyle: 'italic' as const,
                    textDecorationLine: 'underline' as const,
                  },
                ],
                fontSize: 16,
                textAlign: 'center' as const,
                marginVertical: 4,
              },
            },
            // RichText container — wrapping flex row of Text elements. Children
            // are real flex children, so box props work: the highlighted segment
            // is a padded, rounded, rotated chip.
            {
              id: 'richtext-container-demo',
              type: 'RichText' as const,
              props: {
                alignItems: 'center' as const,
                justifyContent: 'center' as const,
                marginVertical: 4,
                // Base typography declared once — children inherit it.
                fontSize: 22,
                fontWeight: '600',
              },
              children: [
                // Plain-text children split into words → wrap word-by-word.
                { id: 'rt-1', type: 'Text' as const, props: { content: 'Boost your' } },
                {
                  id: 'rt-2',
                  type: 'Text' as const,
                  // Chip: box styling keeps it atomic; overrides inherited defaults.
                  props: {
                    content: 'energy',
                    fontWeight: '700',
                    color: '#FFFFFF',
                    backgroundColor: '#E11D48',
                    paddingHorizontal: 14,
                    paddingVertical: 4,
                    borderRadius: 200,
                    marginHorizontal: 4,
                    transform: { rotate: -3 },
                  },
                },
                {
                  id: 'rt-3',
                  type: 'Text' as const,
                  renderWhen: { variable: 'name', operator: 'is_not_empty' as const },
                  props: { content: ', {{name}}!', mode: 'expression' as const },
                },
              ],
            },
            // Left-aligned RichText — demonstrates the textAlign fix.
            {
              id: 'richtext-left-demo',
              type: 'RichText' as const,
              props: {
                textAlign: 'left' as const,
                fontSize: 18,
                marginVertical: 4,
              },
              children: [
                { id: 'rt-left-1', type: 'Text' as const, props: { content: 'Left aligned' } },
                { id: 'rt-left-2', type: 'Text' as const, props: { content: 'rich text' } },
              ],
            },
            // Horizontal ScrollView demo — swipeable row of cards.
            {
              id: 'scroll-demo',
              type: 'ScrollView' as const,
              props: {
                horizontal: true,
                showsHorizontalScrollIndicator: false,
                contentContainerPadding: 4,
                alignItems: 'center' as const,
              },
              children: [
                {
                  id: 'scroll-card-1',
                  type: 'Text' as const,
                  props: {
                    content: 'Card 1',
                    width: 160,
                    height: 100,
                    marginHorizontal: 6,
                    borderWidth: 1,
                    borderRadius: 12,
                    borderColor: '#00000020',
                    paddingVertical: 38,
                    textAlign: 'center' as const,
                    fontSize: 16,
                    fontWeight: '600' as const,
                  },
                },
                {
                  id: 'scroll-card-2',
                  type: 'Text' as const,
                  props: {
                    content: 'Card 2',
                    width: 160,
                    height: 100,
                    marginHorizontal: 6,
                    borderWidth: 1,
                    borderRadius: 12,
                    borderColor: '#00000020',
                    paddingVertical: 38,
                    textAlign: 'center' as const,
                    fontSize: 16,
                    fontWeight: '600' as const,
                  },
                },
                {
                  id: 'scroll-card-3',
                  type: 'Text' as const,
                  props: {
                    content: 'Card 3',
                    width: 160,
                    height: 100,
                    marginHorizontal: 6,
                    borderWidth: 1,
                    borderRadius: 12,
                    borderColor: '#00000020',
                    paddingVertical: 38,
                    textAlign: 'center' as const,
                    fontSize: 16,
                    fontWeight: '600' as const,
                  },
                },
                {
                  id: 'scroll-card-4',
                  type: 'Text' as const,
                  props: {
                    content: 'Card 4',
                    width: 160,
                    height: 100,
                    marginHorizontal: 6,
                    borderWidth: 1,
                    borderRadius: 12,
                    borderColor: '#00000020',
                    paddingVertical: 38,
                    textAlign: 'center' as const,
                    fontSize: 16,
                    fontWeight: '600' as const,
                  },
                },
              ],
            },
            // Expression text — updates live as user types
            {
              id: 'greeting',
              type: 'Text' as const,
              props: {
                content: 'Hello {{name}}!',
                mode: 'expression' as const,
                fontSize: 18,
                fontWeight: '600',
                textAlign: 'center' as const,
                marginVertical: 4,
              },
            },
            // Header text
            {
              id: 'headline',
              type: 'Text',
              props: {
                content: 'Built from the CMS',
                fontSize: 28,
                fontWeight: '700',
                fontFamily: 'Bangers_400Regular',
                textAlign: 'center',
              },
            },
            {
              id: 'subheadline',
              type: 'Text',
              props: {
                content: 'This screen is composed entirely from a JSON payload — no custom renderer needed.',
                fontSize: 15,
                fontStyle: 'italic',
                textAlign: 'center',
                lineHeight: 22,
                opacity: 0.6,
              },
            },
            // Feature cards row
            {
              id: 'cards-row',
              type: 'XStack',
              props: { gap: 12 },
              children: [
                {
                  id: 'card-layout',
                  type: 'YStack',
                  props: {
                    flex: 1,
                    padding: 16,
                    gap: 8,
                    borderWidth: 1,
                    borderRadius: 12,
                    borderColor: '#E0E0E0',
                    overflow: 'hidden',
                  },
                  children: [
                    {
                      id: 'card-layout-title',
                      type: 'Text',
                      props: { content: 'Layout', fontSize: 13, fontWeight: '600' },
                    },
                    {
                      id: 'card-layout-body',
                      type: 'Text',
                      props: {
                        content: 'YStack, XStack with flex, gap, padding & margin',
                        fontSize: 12,
                        lineHeight: 18,
                        opacity: 0.6,
                      },
                    },
                  ],
                },
                {
                  id: 'card-border',
                  type: 'YStack',
                  props: {
                    flex: 1,
                    padding: 16,
                    gap: 8,
                    borderWidth: 1,
                    borderRadius: 12,
                    borderColor: '#E0E0E0',
                    overflow: 'hidden',
                  },
                  children: [
                    {
                      id: 'card-border-title',
                      type: 'Text',
                      props: { content: 'Borders', fontSize: 13, fontWeight: '600' },
                    },
                    {
                      id: 'card-border-body',
                      type: 'Text',
                      props: {
                        content: 'borderWidth, borderRadius, borderColor, overflow',
                        fontSize: 12,
                        lineHeight: 18,
                        opacity: 0.6,
                      },
                    },
                  ],
                },
              ],
            },
            // Shadowed YStack card (verifies BaseBoxProps shadow* on containers)
            {
              id: 'card-shadow',
              type: 'YStack',
              props: {
                padding: 16,
                gap: 8,
                marginVertical: 8,
                borderRadius: 12,
                backgroundColor: '#FFFFFF',
                shadowColor: '#000000',
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.2,
                shadowRadius: 8,
                elevation: 4,
              },
              children: [
                {
                  id: 'card-shadow-title',
                  type: 'Text',
                  props: { content: 'Shadow', fontSize: 13, fontWeight: '600' },
                },
                {
                  id: 'card-shadow-body',
                  type: 'Text',
                  props: {
                    content: 'shadowColor, shadowOffset, shadowOpacity, shadowRadius, elevation on a YStack',
                    fontSize: 12,
                    lineHeight: 18,
                    opacity: 0.6,
                  },
                },
              ],
            },
            // Radio group element
            {
              id: 'hero-radio',
              type: 'RadioGroup' as const,
              props: {
                variableName: 'plan',
                defaultValue: 'monthly',
                haptic: 'light' as const,
                showTick: true,
                tickPosition: 'end' as const,
                tickSelectedColor: '#3B82F6',
                tickSize: 24,
                itemAlignItems: 'center' as const,
                itemGap: 14,
                itemSubLabelColor: '#9CA3AF',
                itemSubLabelFontSize: 13,
                gap: 8,
                marginVertical: 8,
                itemBackgroundColor: '#FFFFFF',
                itemBorderWidth: 0,
                itemShadowColor: '#000000',
                itemShadowOffset: { width: 0, height: 2 },
                itemShadowOpacity: 0.15,
                itemShadowRadius: 6,
                itemElevation: 3,
                items: [
                  { label: 'Monthly', value: 'monthly', subLabel: '$9.99 billed monthly' },
                  { label: 'Yearly', value: 'yearly', subLabel: '$59.99 billed yearly — save 50%' },
                  { label: 'Lifetime', value: 'lifetime', subLabel: '$149.99 one-time' },
                ],
              },
            },
            // Expression text — shows selected plan
            {
              id: 'plan-display',
              type: 'Text' as const,
              props: {
                content: 'Selected: {{plan}}',
                mode: 'expression' as const,
                fontSize: 14,
                textAlign: 'center' as const,
                opacity: 0.7,
                marginVertical: 4,
              },
            },
            // Slider element — numeric value bound to a variable
            {
              id: 'hero-slider',
              type: 'Slider' as const,
              props: {
                variableName: 'intensity',
                defaultValue: 0.5,
                min: 0,
                max: 1,
                step: 0.1,
                marginVertical: 8,
              },
            },
            // Expression text — shows slider value
            {
              id: 'intensity-display',
              type: 'Text' as const,
              props: {
                content: 'Intensity: {{intensity}}',
                mode: 'expression' as const,
                fontSize: 14,
                textAlign: 'center' as const,
                opacity: 0.7,
                marginVertical: 4,
              },
            },
            // Checkbox group element
            {
              id: 'hero-checkbox',
              type: 'CheckboxGroup' as const,
              props: {
                variableName: 'goals',
                defaultValues: ['health', 'fitness'],
                haptic: 'light' as const,
                showTick: true,
                tickBorderRadius: 10,
                tickSelectedColor: '#10B981',
                tickSize: 28,
                direction: 'horizontal' as const,
                itemAlignItems: 'center' as const,
                itemGap: 8,
                gap: 12,
                marginVertical: 8,
                items: [
                  { label: 'Improve health', value: 'health', image: { url: 'https://picsum.photos/seed/health/200', width: 72, height: 72, borderRadius: 12, resizeMode: 'cover' as const } },
                  { label: 'Build fitness', value: 'fitness', image: { url: 'https://picsum.photos/seed/fitness/200', width: 72, height: 72, borderRadius: 12, resizeMode: 'cover' as const } },
                  { label: 'Lose weight', value: 'weight', image: { url: 'https://picsum.photos/seed/weight/200', width: 72, height: 72, borderRadius: 12, resizeMode: 'cover' as const } },
                  { label: 'Gain muscle', value: 'muscle', image: { url: 'https://picsum.photos/seed/muscle/200', width: 72, height: 72, borderRadius: 12, resizeMode: 'cover' as const } },
                ],
              },
            },
            // Expression text — shows selected goals
            {
              id: 'goals-display',
              type: 'Text' as const,
              props: {
                content: 'Goals: {{goals}}',
                mode: 'expression' as const,
                fontSize: 14,
                textAlign: 'center' as const,
                opacity: 0.7,
                marginVertical: 4,
              },
            },
            // Date picker element
            {
              id: 'hero-date-picker',
              type: 'DatePicker' as const,
              props: {
                variableName: 'birthdate',
                defaultValue: '1990-01-01T00:00:00.000Z',
                mode: 'date' as const,
                display: 'spinner' as const,
                maximumDate: 'now',
                marginVertical: 8,
              },
            },
            // Expression text — shows selected date
            {
              id: 'birthdate-display',
              type: 'Text' as const,
              props: {
                content: 'Birth date: {{birthdate}}',
                mode: 'expression' as const,
                fontSize: 14,
                textAlign: 'center' as const,
                opacity: 0.7,
                marginVertical: 4,
              },
            },
            // Wheel picker element — numeric range
            {
              id: 'hero-weight-wheel',
              type: 'WheelPicker' as const,
              props: {
                variableName: 'weight',
                defaultValue: '70',
                range: { min: 40, max: 200, step: 1, unit: 'kg' },
                height: 180,
                marginVertical: 8,
              },
            },
            // Expression text — shows selected weight
            {
              id: 'weight-display',
              type: 'Text' as const,
              props: {
                content: 'Weight: {{weight}}',
                mode: 'expression' as const,
                fontSize: 14,
                textAlign: 'center' as const,
                opacity: 0.7,
                marginVertical: 4,
              },
            },
            // DrawingPad element — freehand signature/drawing. Serializes to
            // `signature` (SVG path) + `signatureImage` (base64 PNG data URI).
            {
              id: 'hero-drawing-pad',
              type: 'DrawingPad' as const,
              props: {
                variableName: 'signature',
                imageVariableName: 'signatureImage',
                strokeWidth: 3,
                height: 180,
                borderRadius: 16,
                marginVertical: 8,
                clearable: true,
              },
            },
            // Confirmation — shown once the pad has been drawn on
            {
              id: 'signature-confirm',
              type: 'Text' as const,
              renderWhen: { variable: 'signature', operator: 'is_not_empty' as const },
              props: {
                content: 'Signature captured ✓',
                fontSize: 14,
                textAlign: 'center' as const,
                opacity: 0.7,
                marginVertical: 4,
              },
            },
            // Carousel element
            {
              id: 'hero-carousel',
              type: 'Carousel' as const,
              props: {
                carouselType: 'parallax' as const,
                autoPlay: true,
                autoPlayInterval: 3000,
                loop: true,
                showDots: true,
                dotColor: '#E9C46A',
                activeDotColor: '#E76F51',
                dotWidth: 8,
                dotHeight: 8,
                activeDotWidth: 24,
                activeDotHeight: 8,
                dotsGap: 8,
                dotsPosition: 'bottom' as const,
                dotsMarginTop: 12,
                height: 220,
                borderRadius: 16,
                marginVertical: 8,
              },
              children: [
                {
                  id: 'carousel-slide-1',
                  type: 'Image' as const,
                  props: {
                    url: 'https://picsum.photos/400/220?random=10',
                    height: 220,
                    resizeMode: 'cover' as const,
                  },
                },
                {
                  id: 'carousel-slide-2',
                  type: 'Image' as const,
                  props: {
                    url: 'https://picsum.photos/400/220?random=11',
                    height: 220,
                    resizeMode: 'cover' as const,
                  },
                },
                {
                  id: 'carousel-slide-3',
                  type: 'Image' as const,
                  props: {
                    url: 'https://picsum.photos/400/220?random=12',
                    height: 220,
                    resizeMode: 'cover' as const,
                  },
                },
              ],
            },
            // ZStack: image with text overlay
            {
              id: 'zstack-demo',
              type: 'ZStack' as const,
              props: {
                height: 200,
                borderRadius: 16,
                overflow: 'hidden',
                marginVertical: 8,
              },
              children: [
                {
                  id: 'zstack-bg',
                  type: 'Image' as const,
                  props: {
                    url: 'https://picsum.photos/800/400?random=20',
                    height: 200,
                    resizeMode: 'cover' as const,
                  },
                },
                {
                  id: 'zstack-overlay',
                  type: 'YStack' as const,
                  props: {
                    flex: 1,
                    backgroundColor: 'rgba(0,0,0,0.45)',
                    padding: 20,
                    justifyContent: 'flex-end' as const,
                  },
                  children: [
                    {
                      id: 'zstack-label',
                      type: 'Text' as const,
                      props: {
                        content: 'ZStack: layered elements',
                        fontSize: 18,
                        fontWeight: '700',
                        color: '#fff',
                      },
                    },
                  ],
                },
              ],
            },
            // Button element — runs a custom action with selected variables, then continues.
            {
              id: 'hero-button',
              type: 'Button' as const,
              props: {
                label: 'Get Started',
                variant: 'filled' as const,
                marginVertical: 8,
                haptic: 'medium' as const,
                actions: [
                  { type: 'custom' as const, function: 'trackCta', variables: ['name', 'plan', 'goals'] },
                  'continue' as const,
                ],
              },
            },
            // Outlined button — uses the legacy `action: "continue"` form (back-compat alias).
            {
              id: 'hero-button-outlined',
              type: 'Button' as const,
              props: {
                label: 'Learn More',
                variant: 'outlined' as const,
                marginVertical: 4,
                action: 'continue' as const,
              },
            },
            // Highlighted info block
            {
              id: 'info-block',
              type: 'YStack',
              props: {
                padding: 20,
                gap: 6,
                borderRadius: 12,
                backgroundColor: '#F0F7FF',
                borderWidth: 1,
                borderColor: '#C7DEFF',
              },
              children: [
                {
                  id: 'info-label',
                  type: 'XStack',
                  props: { gap: 6, alignItems: 'center' },
                  children: [
                    {
                      id: 'info-badge',
                      type: 'YStack',
                      props: {
                        backgroundColor: '#007AFF',
                        borderRadius: 4,
                        paddingHorizontal: 8,
                        paddingVertical: 2,
                      },
                      children: [
                        {
                          id: 'info-badge-text',
                          type: 'Text',
                          props: { content: 'NEW', fontSize: 10, fontWeight: '700', color: '#fff' },
                        },
                      ],
                    },
                    {
                      id: 'info-title',
                      type: 'Text',
                      props: { content: 'ComposableScreen', fontSize: 15, fontWeight: '600' },
                    },
                  ],
                },
                {
                  id: 'info-body',
                  type: 'Text',
                  props: {
                    content: 'Update this screen\'s content, layout, and styling without shipping a new app version.',
                    fontSize: 13,
                    lineHeight: 20,
                    opacity: 0.7,
                  },
                },
              ],
            },
            // Gradient backgrounds demo
            {
              id: 'gradient-section-title',
              type: 'Text' as const,
              props: {
                content: 'Gradient Backgrounds',
                fontSize: 17,
                fontWeight: '700',
                marginVertical: 8,
              },
            },
            // Gradient YStack card
            {
              id: 'gradient-card',
              type: 'YStack' as const,
              props: {
                padding: 20,
                gap: 8,
                borderRadius: 16,
                overflow: 'hidden',
                marginVertical: 4,
                backgroundGradient: {
                  type: 'linear' as const,
                  from: 'topLeft' as const,
                  to: 'bottomRight' as const,
                  stops: [
                    { color: '#6C63FF' },
                    { color: '#FF6584' },
                  ],
                },
              },
              children: [
                {
                  id: 'gradient-card-title',
                  type: 'Text',
                  props: { content: 'Linear gradient', fontSize: 15, fontWeight: '700', color: '#fff' },
                },
                {
                  id: 'gradient-card-body',
                  type: 'Text',
                  props: { content: 'from: topLeft → to: bottomRight', fontSize: 12, color: '#fff', opacity: 0.85 },
                },
              ],
            },
            // Gradient Button — fires multiple custom actions before continuing.
            {
              id: 'gradient-button',
              type: 'Button' as const,
              props: {
                label: 'Gradient Button',
                variant: 'filled' as const,
                marginVertical: 4,
                actions: [
                  { type: 'custom' as const, function: 'celebrate' },
                  { type: 'custom' as const, function: 'trackCta', variables: ['name'] },
                  'continue' as const,
                ],
                backgroundGradient: {
                  type: 'linear' as const,
                  from: 'left' as const,
                  to: 'right' as const,
                  stops: [
                    { color: '#FF6584', position: 0 },
                    { color: '#6C63FF', position: 1 },
                  ],
                },
              },
            },
            // Button states & shadow showcase (OS-161)
            {
              id: 'states-heading',
              type: 'Text' as const,
              props: {
                content: 'Button states & shadow',
                fontSize: 13,
                fontWeight: '700',
                marginVertical: 4,
                opacity: 0.5,
              },
            },
            // Shadow + elevation only (press to feel the default opacity transition).
            {
              id: 'btn-shadow',
              type: 'Button' as const,
              props: {
                label: 'Elevated (shadow)',
                variant: 'filled' as const,
                marginVertical: 4,
                actions: [{ type: 'custom' as const, function: 'celebrate' }],
                backgroundColor: '#6C63FF',
                shadowColor: '#6C63FF',
                shadowOffset: { width: 0, height: 6 },
                shadowOpacity: 0.4,
                shadowRadius: 12,
                elevation: 8,
              },
            },
            // pressedStyle — recolors + dims while held, slow 300ms transition.
            {
              id: 'btn-pressed',
              type: 'Button' as const,
              props: {
                label: 'Press me (hold)',
                variant: 'filled' as const,
                marginVertical: 4,
                actions: [{ type: 'custom' as const, function: 'celebrate' }],
                backgroundColor: '#10b981',
                transitionDurationMs: 300,
                pressedStyle: {
                  opacity: 0.6,
                  backgroundColor: '#065f46',
                },
              },
            },
            // disabledStyle — always disabled to show the disabled visual override.
            {
              id: 'btn-disabled',
              type: 'Button' as const,
              props: {
                label: 'Always disabled',
                variant: 'filled' as const,
                marginVertical: 4,
                actions: ['continue' as const],
                disabledWhen: {
                  variable: 'never_enabled',
                  operator: 'neq' as const,
                  value: 'yes',
                },
                disabledStyle: {
                  backgroundColor: '#fee2e2',
                  color: '#b91c1c',
                  borderRadius: 12,
                },
              },
            },
            // Disable-on-condition demo: gated continue + a setVariable companion.
            {
              id: 'consent-toggle',
              type: 'Button' as const,
              props: {
                label: 'I agree to the terms',
                variant: 'outlined' as const,
                marginVertical: 8,
                actions: [
                  { type: 'setVariable' as const, name: 'consent_given', value: 'yes', label: 'Agreed' },
                ],
              },
            },
            {
              id: 'gated-continue',
              type: 'Button' as const,
              props: {
                label: 'Continue (gated)',
                variant: 'filled' as const,
                marginVertical: 4,
                actions: ['continue' as const],
                disabledWhen: {
                  variable: 'consent_given',
                  operator: 'neq' as const,
                  value: 'yes',
                },
                transitionDurationMs: 180,
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.18,
                shadowRadius: 8,
                elevation: 4,
                pressedStyle: {
                  opacity: 0.7,
                  backgroundColor: '#4f46e5',
                },
                disabledStyle: {
                  backgroundColor: '#d1d5db',
                  color: '#6b7280',
                  shadowOpacity: 0,
                  elevation: 0,
                },
              },
            },
            // renderWhen demo — text only renders once consent is given
            {
              id: 'consent-confirmation',
              renderWhen: {
                variable: 'consent_given',
                operator: 'eq' as const,
                value: 'yes',
              },
              type: 'Text' as const,
              props: {
                content: '✅ Consent recorded — you may continue',
                fontSize: 14,
                fontWeight: '600' as const,
                textAlign: 'center' as const,
                marginVertical: 4,
              },
            },
            // Gradient horizontal band
            {
              id: 'gradient-band',
              type: 'XStack' as const,
              props: {
                height: 48,
                borderRadius: 8,
                marginVertical: 4,
                overflow: 'hidden',
                backgroundGradient: {
                  type: 'linear' as const,
                  from: 'left' as const,
                  to: 'right' as const,
                  stops: [
                    { color: '#43E97B', position: 0 },
                    { color: '#38F9D7', position: 0.5 },
                    { color: '#4FACFE', position: 1 },
                  ],
                },
              },
              children: [],
            },
          ],
        },
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
