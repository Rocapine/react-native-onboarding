import { Onboarding } from "./types";

export const onboardingExample = {
  metadata: {
    id: "example-onboarding",
    name: "Example Onboarding",
    audienceId: undefined,
    audienceName: undefined,
    audienceOrder: undefined,
    draft: true,
  },
  fonts: {
    Inter: {
      regular: "https://cdn.jsdelivr.net/fontsource/fonts/inter@latest/latin-400-normal.ttf",
      medium: "https://cdn.jsdelivr.net/fontsource/fonts/inter@latest/latin-500-normal.ttf",
      bold: "https://cdn.jsdelivr.net/fontsource/fonts/inter@latest/latin-700-normal.ttf",
    },
    Lobster: {
      regular: "https://cdn.jsdelivr.net/fontsource/fonts/lobster@latest/latin-400-normal.ttf",
    },
  },
  steps: [
    {
      id: "welcome",
      name: "Welcome",
      type: "MediaContent",
      payload: {
        title: "Welcome Test 11/12!",
        description: "Get started with your personalized experience",
        mediaSource: {
          url: "https://api-ninjas.com/images/cats/abyssinian.jpg",
          type: "image",
        },
      },
      figmaUrl: null,
      customPayload: {},
      continueButtonLabel: "Continue",
      displayProgressHeader: true,
    },
    {
      id: "question-favorite-color",
      name: "Favorite Color",
      type: "Question",
      payload: {
        title: "What's your favorite color?",
        answers: [
          { label: "Red", value: "red" },
          { label: "Blue", value: "blue" },
          { label: "Green", value: "green" },
          { label: "Yellow", value: "yellow" },
        ],
        infoBox: null,
        subtitle: null,
        multipleAnswer: false,
      },
      figmaUrl: null,
      customPayload: {},
      displayProgressHeader: true,
    },
    {
      id: "picker-name",
      name: "Name",
      type: "Picker",
      payload: {
        title: "What's your name?",
        pickerType: "name",
        description: "",
      },
      figmaUrl: null,
      customPayload: {},
      continueButtonLabel: "Continue",
      displayProgressHeader: true,
    },
    {
      id: "loader-creating-profile",
      name: "Creating Profile",
      type: "Loader",
      payload: {
        steps: [
          {
            label: "Processing your information",
            completed: "Information processed",
          },
          { label: "Setting up your profile", completed: "Profile ready" },
          { label: "Preparing your experience", completed: "All set!" },
        ],
        title: "Creating your personalized profile...",
        variant: "bars",
        duration: 2000,
        didYouKnowImages: [
          { url: "https://picsum.photos/300/200?random=1", type: "image" },
          { url: "https://picsum.photos/300/200?random=2", type: "image" },
          { url: "https://picsum.photos/300/200?random=3", type: "image" },
        ],
      },
      figmaUrl: null,
      customPayload: {},
      continueButtonLabel: "Continue",
      displayProgressHeader: false,
    },
    {
      id: "composable-screen-demo",
      name: "Composable Screen",
      type: "ComposableScreen",
      displayProgressHeader: true,
      payload: {
        elements: [
          {
            id: "safe-root",
            type: "SafeAreaView",
            props: { flex: 1, edges: ["top", "bottom"] },
            children: [
          {
            id: "scroll-root",
            type: "ScrollView",
            props: { flex: 1, showsVerticalScrollIndicator: false },
            children: [
          {
            id: "root",
            type: "YStack",
            props: { gap: 24, padding: 24 },
            children: [
              {
                id: "hero-lottie",
                type: "Lottie",
                props: {
                  source: "https://raw.githubusercontent.com/airbnb/lottie-web/master/demo/adrock/data.json",
                  height: 180,
                  autoPlay: true,
                  loop: true,
                },
              },
              {
                id: "hero-rive",
                type: "Rive",
                props: {
                  url: "https://cdn.rive.app/animations/vehicles.riv",
                  width: "100%",
                  aspectRatio: 16 / 9,
                  autoPlay: true,
                  fit: "FitWidth",
                },
              },
              {
                id: "hero-image",
                type: "Image",
                props: {
                  url: "https://picsum.photos/800/400?grayscale",
                  height: 180,
                  resizeMode: "cover",
                  borderRadius: 16,
                  // Slide + fade in on mount (reanimated builder name + modifiers).
                  animation: {
                    entering: { preset: "FadeInDown", duration: 500, delay: 100, easing: "ease-out" },
                  },
                  // Generic onPress: any non-pressable element can dispatch the same
                  // action list as Button. Tapping the hero records a flag, and
                  // toggles "hero" into the `favorites` multi-select (arrayOp) —
                  // same JSON-array encoding as CheckboxGroup, no widget needed.
                  onPress: [
                    { type: "setVariable", name: "hero_tapped", value: "true", kind: "string" },
                    { type: "setVariable", name: "favorites", value: "hero", label: "Hero", arrayOp: "toggle" },
                  ],
                },
              },
              {
                id: "svg-demo",
                type: "Image",
                props: {
                  url: "https://upload.wikimedia.org/wikipedia/commons/0/02/SVG_logo.svg",
                  width: 80,
                  height: 80,
                  resizeMode: "contain",
                },
              },
              {
                id: "webp-demo",
                type: "Image",
                props: {
                  url: "https://www.gstatic.com/webp/gallery/1.webp",
                  width: "100%",
                  aspectRatio: 1.5,
                  resizeMode: "cover",
                  borderRadius: 12,
                },
              },
              {
                id: "webp-demo-2",
                type: "Image",
                props: {
                  url: "https://www.gstatic.com/webp/gallery/4.webp",
                  width: "100%",
                  aspectRatio: 16 / 9,
                  resizeMode: "cover",
                  borderRadius: 12,
                  marginVertical: 8,
                  // Uniform blur (Phase 1) — RN/expo-image native blurRadius.
                  blurRadius: 8,
                },
              },
              {
                id: "progressive-blur-demo",
                type: "ProgressiveBlurImage",
                props: {
                  url: "https://picsum.photos/800/600?random=88",
                  width: "100%",
                  aspectRatio: 4 / 3,
                  resizeMode: "cover",
                  borderRadius: 12,
                  marginVertical: 8,
                  intensity: 60,
                  tint: "dark",
                  maxBlurOpacity: 0.8,
                  // Sharp at top, progressively blurred toward the bottom.
                  mask: {
                    from: "top",
                    to: "bottom",
                    stops: [
                      { position: 0, opacity: 0 },
                      { position: 0.4, opacity: 0 },
                      { position: 1, opacity: 1 },
                    ],
                  },
                  // Photo shows sharp, then the blur fades in after a beat.
                  blurAppear: { delay: 400, duration: 600, easing: "ease-out" },
                },
              },
              {
                id: "hero-icon",
                type: "Icon",
                props: {
                  name: "Star",
                  size: 48,
                  color: "#007AFF",
                  fill: "#007AFF",
                  fillOpacity: 0.2,
                  marginVertical: 8,
                  // Static tilt + continuous breathing pulse.
                  transform: { rotate: -8 },
                  animation: {
                    entering: { preset: "ZoomIn", duration: 400, spring: { damping: 10, stiffness: 160 } },
                    effect: { preset: "pulse", duration: 1200, minScale: 0.92, maxScale: 1.08 },
                  },
                },
              },
              {
                id: "progress-linear",
                type: "ProgressIndicator",
                props: {
                  variant: "linear",
                  autoplay: true,
                  loop: true,
                  initialValue: 0,
                  duration: 2500,
                  easing: "ease-in-out",
                  thickness: 10,
                  showLabel: true,
                  marginVertical: 8,
                },
              },
              {
                id: "progress-circular",
                type: "ProgressIndicator",
                props: {
                  variant: "circular",
                  autoplay: true,
                  loop: false,
                  initialValue: 0,
                  duration: 1800,
                  delay: 500,
                  easing: "ease-out",
                  size: 120,
                  thickness: 12,
                  showLabel: true,
                  alignSelf: "center",
                },
              },
              {
                // Count-up: animates a real value 0 -> 5000 (not a percentage)
                // via minValue/maxValue, snapping by `step` (100 hops, not 5000).
                // Writes the live value to `membersJoined`; the Text below reads it.
                id: "progress-countup",
                type: "ProgressIndicator",
                props: {
                  variant: "linear",
                  autoplay: true,
                  loop: false,
                  minValue: 0,
                  maxValue: 5000,
                  step: 50,
                  variableName: "membersJoined",
                  duration: 2000,
                  easing: "ease-out",
                  thickness: 8,
                  showLabel: false,
                  marginVertical: 8,
                },
              },
              {
                id: "progress-countup-text",
                type: "Text",
                props: {
                  content: "{{membersJoined}} members joined",
                  mode: "expression",
                  fontSize: 18,
                  textAlign: "center",
                  marginVertical: 4,
                },
              },
              {
                // AnimatedText: the same count-up animated entirely on the UI
                // thread (native TextInput) — zero re-renders, no variable write.
                id: "animated-countup",
                type: "AnimatedText",
                props: {
                  from: 0,
                  to: 1028709,
                  duration: 2500,
                  easing: "ease-out",
                  thousandsSeparator: ",",
                  fontSize: 28,
                  fontWeight: "700",
                  textAlign: "center",
                  marginVertical: 4,
                },
              },
              {
                id: "hero-video",
                type: "Video",
                props: {
                  url: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4",
                  height: 200,
                  borderRadius: 12,
                  controls: true,
                  muted: true,
                  contentFit: "cover",
                },
              },
              {
                id: "kav-input",
                type: "KeyboardAvoidingView",
                props: { keyboardVerticalOffset: 24 },
                children: [
                  {
                    id: "hero-input",
                    type: "Input",
                    props: {
                      variableName: "name",
                      placeholder: "Enter your name",
                      keyboardType: "default",
                      returnKeyType: "done",
                      autoCapitalize: "words",
                      autoFocus: true,
                      marginVertical: 8,
                    },
                  },
                ],
              },
              {
                // Only shown once `name` has a non-empty value — demonstrates
                // the unary `is_not_empty` condition operator.
                id: "name-greeting",
                type: "Text",
                renderWhen: { variable: "name", operator: "is_not_empty" },
                props: {
                  content: "Nice to meet you, {{name}}!",
                  mode: "expression",
                  fontSize: 14,
                  textAlign: "center",
                  opacity: 0.6,
                  marginVertical: 4,
                },
              },
              {
                // DrawingPad — freehand signature/drawing surface. On each
                // completed stroke it serializes the drawing into variables:
                // `signature` (SVG path string) + `signatureImage` (base64 PNG
                // data URI). Requires @shopify/react-native-skia.
                id: "signature-pad",
                type: "DrawingPad",
                props: {
                  variableName: "signature",
                  imageVariableName: "signatureImage",
                  strokeWidth: 3,
                  height: 180,
                  borderRadius: 16,
                  marginVertical: 8,
                  clearable: true,
                },
              },
              {
                // Confirmation shown once the pad has been drawn on —
                // demonstrates reading the DrawingPad's SVG variable.
                id: "signature-confirm",
                type: "Text",
                renderWhen: { variable: "signature", operator: "is_not_empty" },
                props: {
                  content: "Signature captured ✓",
                  fontSize: 14,
                  textAlign: "center",
                  opacity: 0.6,
                  marginVertical: 4,
                },
              },
              {
                // Inline rich text — `content` as an array of styled spans.
                // Each span inherits the parent Text style and overrides only
                // what it sets (here: weight, color, underline).
                id: "richtext-demo",
                type: "Text",
                props: {
                  content: [
                    { text: "Lose " },
                    { text: "5kg", fontWeight: "700", color: "#E11D48" },
                    { text: " in 30 days — " },
                    {
                      text: "guaranteed",
                      fontStyle: "italic",
                      textDecorationLine: "underline",
                    },
                  ],
                  fontSize: 16,
                  textAlign: "center",
                  marginVertical: 4,
                },
              },
              {
                // RichText container — a wrapping flex row of `Text` elements.
                // Each child is a real flex child (not nested `<Text>`), so it
                // honors box props: the highlighted segment is a padded, rounded,
                // rotated "chip". Children also keep their own renderWhen.
                id: "richtext-container-demo",
                type: "RichText",
                props: {
                  alignItems: "center",
                  justifyContent: "center",
                  marginVertical: 4,
                  // Base typography declared once — children inherit it.
                  fontSize: 22,
                  fontWeight: "600",
                },
                children: [
                  // Plain-text children split into words → wrap word-by-word.
                  { id: "rt-1", type: "Text", props: { content: "Boost your" } },
                  {
                    id: "rt-2",
                    type: "Text",
                    // Chip: box styling keeps it atomic; overrides inherited defaults.
                    props: {
                      content: "energy",
                      fontWeight: "700",
                      color: "#FFFFFF",
                      backgroundColor: "#E11D48",
                      paddingHorizontal: 14,
                      paddingVertical: 4,
                      borderRadius: 200,
                      marginHorizontal: 4,
                      transform: { rotate: -3 },
                    },
                  },
                  {
                    id: "rt-3",
                    type: "Text",
                    renderWhen: { variable: "name", operator: "is_not_empty" },
                    props: { content: ", {{name}}!", mode: "expression" },
                  },
                ],
              },
              {
                // Left-aligned RichText — demonstrates the textAlign fix.
                id: "richtext-left-demo",
                type: "RichText",
                props: {
                  textAlign: "left",
                  fontSize: 18,
                  marginVertical: 4,
                },
                children: [
                  { id: "rt-left-1", type: "Text", props: { content: "Left aligned" } },
                  { id: "rt-left-2", type: "Text", props: { content: "rich text" } },
                ],
              },
              {
                id: "scroll-demo",
                type: "ScrollView",
                props: {
                  horizontal: true,
                  showsHorizontalScrollIndicator: false,
                  contentContainerPadding: 4,
                  alignItems: "center",
                },
                children: [
                  {
                    id: "scroll-card-1",
                    type: "Text",
                    props: {
                      content: "Card 1",
                      width: 160,
                      height: 100,
                      marginHorizontal: 6,
                      borderWidth: 1,
                      borderRadius: 12,
                      borderColor: "#00000020",
                      paddingVertical: 38,
                      textAlign: "center",
                      fontSize: 16,
                      fontWeight: "600",
                    },
                  },
                  {
                    id: "scroll-card-2",
                    type: "Text",
                    props: {
                      content: "Card 2",
                      width: 160,
                      height: 100,
                      marginHorizontal: 6,
                      borderWidth: 1,
                      borderRadius: 12,
                      borderColor: "#00000020",
                      paddingVertical: 38,
                      textAlign: "center",
                      fontSize: 16,
                      fontWeight: "600",
                    },
                  },
                  {
                    id: "scroll-card-3",
                    type: "Text",
                    props: {
                      content: "Card 3",
                      width: 160,
                      height: 100,
                      marginHorizontal: 6,
                      borderWidth: 1,
                      borderRadius: 12,
                      borderColor: "#00000020",
                      paddingVertical: 38,
                      textAlign: "center",
                      fontSize: 16,
                      fontWeight: "600",
                    },
                  },
                  {
                    id: "scroll-card-4",
                    type: "Text",
                    props: {
                      content: "Card 4",
                      width: 160,
                      height: 100,
                      marginHorizontal: 6,
                      borderWidth: 1,
                      borderRadius: 12,
                      borderColor: "#00000020",
                      paddingVertical: 38,
                      textAlign: "center",
                      fontSize: 16,
                      fontWeight: "600",
                    },
                  },
                ],
              },
              {
                id: "greeting",
                type: "Text",
                props: {
                  content: "Hello {{name}}!",
                  mode: "expression",
                  fontSize: 18,
                  fontWeight: "600",
                  textAlign: "center",
                  marginVertical: 4,
                },
              },
              {
                id: "headline",
                type: "Text",
                props: {
                  content: "Built from the CMS",
                  fontSize: 28,
                  fontWeight: "700",
                  fontFamily: "Inter",
                  textAlign: "center",
                },
              },
              {
                id: "headline-display",
                type: "Text",
                props: {
                  content: "Runtime-loaded font",
                  fontSize: 32,
                  fontFamily: "Lobster",
                  fontStyle: "italic",
                  textAlign: "center",
                  marginVertical: 4,
                },
              },
              {
                id: "inherit-implicit",
                type: "Text",
                props: {
                  content: "Inherits theme.typography.defaultFontFamily (omitted)",
                  fontSize: 14,
                  textAlign: "center",
                  opacity: 0.6,
                },
              },
              {
                id: "inherit-explicit",
                type: "Text",
                props: {
                  content: "Inherits theme.typography.defaultFontFamily (explicit \"inherit\")",
                  fontFamily: "inherit",
                  fontSize: 14,
                  textAlign: "center",
                  opacity: 0.6,
                },
              },
              {
                id: "subheadline",
                type: "Text",
                props: {
                  content:
                    "This screen is composed entirely from a JSON payload — no custom renderer needed.",
                  fontSize: 15,
                  textAlign: "center",
                  lineHeight: 22,
                  opacity: 0.6,
                },
              },
              {
                id: "hero-radio",
                type: "RadioGroup",
                props: {
                  variableName: "plan",
                  defaultValue: "monthly",
                  haptic: "light",
                  showTick: true,
                  tickPosition: "end",
                  tickSelectedColor: "#3B82F6",
                  tickSize: 24,
                  itemAlignItems: "center",
                  itemGap: 14,
                  itemSubLabelColor: "#9CA3AF",
                  itemSubLabelFontSize: 13,
                  gap: 8,
                  marginVertical: 8,
                  itemBackgroundColor: "#FFFFFF",
                  itemBorderWidth: 0,
                  itemShadowColor: "#000000",
                  itemShadowOffset: { width: 0, height: 2 },
                  itemShadowOpacity: 0.15,
                  itemShadowRadius: 6,
                  itemElevation: 3,
                  items: [
                    { label: "Monthly", value: "monthly", subLabel: "$9.99 billed monthly" },
                    { label: "Yearly", value: "yearly", subLabel: "$59.99 billed yearly — save 50%" },
                    { label: "Lifetime", value: "lifetime", subLabel: "$149.99 one-time" },
                  ],
                },
              },
              {
                id: "plan-display",
                type: "Text",
                props: {
                  content: "Selected: {{plan}}",
                  mode: "expression",
                  fontSize: 14,
                  textAlign: "center",
                  opacity: 0.6,
                  marginVertical: 4,
                },
              },
              {
                id: "lifetime-badge",
                renderWhen: {
                  variable: "plan",
                  operator: "eq",
                  value: "lifetime",
                },
                type: "Text",
                props: {
                  content: "🎉 Best value — lifetime access!",
                  fontSize: 14,
                  fontWeight: "600",
                  textAlign: "center",
                  marginVertical: 4,
                },
              },
              {
                id: "hero-slider",
                type: "Slider",
                props: {
                  variableName: "intensity",
                  defaultValue: 0.5,
                  min: 0,
                  max: 1,
                  step: 0.1,
                  marginVertical: 8,
                },
              },
              {
                id: "intensity-display",
                type: "Text",
                props: {
                  content: "Intensity: {{intensity}}",
                  mode: "expression",
                  fontSize: 14,
                  textAlign: "center",
                  opacity: 0.6,
                  marginVertical: 4,
                },
              },
              {
                id: "hero-checkbox",
                type: "CheckboxGroup",
                props: {
                  variableName: "goals",
                  defaultValues: ["health", "fitness"],
                  haptic: "light",
                  showTick: true,
                  tickBorderRadius: 10,
                  tickSelectedColor: "#10B981",
                  tickSize: 28,
                  direction: "horizontal",
                  itemAlignItems: "center",
                  itemGap: 8,
                  gap: 12,
                  marginVertical: 8,
                  items: [
                    { label: "Improve health", value: "health", image: { url: "https://picsum.photos/seed/health/200", width: 72, height: 72, borderRadius: 12, resizeMode: "cover" } },
                    { label: "Build fitness", value: "fitness", image: { url: "https://picsum.photos/seed/fitness/200", width: 72, height: 72, borderRadius: 12, resizeMode: "cover" } },
                    { label: "Lose weight", value: "weight", image: { url: "https://picsum.photos/seed/weight/200", width: 72, height: 72, borderRadius: 12, resizeMode: "cover" } },
                    { label: "Gain muscle", value: "muscle", image: { url: "https://picsum.photos/seed/muscle/200", width: 72, height: 72, borderRadius: 12, resizeMode: "cover" } },
                  ],
                },
              },
              {
                id: "goals-display",
                type: "Text",
                props: {
                  content: "Goals: {{goals}}",
                  mode: "expression",
                  fontSize: 14,
                  textAlign: "center",
                  opacity: 0.6,
                  marginVertical: 4,
                },
              },
              {
                id: "hero-date-picker",
                type: "DatePicker",
                props: {
                  variableName: "birthdate",
                  defaultValue: "1990-01-01T00:00:00.000Z",
                  mode: "date",
                  display: "spinner",
                  maximumDate: "now", // resolves to current date at render time
                  // Custom label format: "1 January 1990" instead of default "Jan 1, 1990"
                  format: { day: "numeric", month: "long", year: "numeric" },
                  marginVertical: 8,
                },
              },
              {
                id: "birthdate-display",
                type: "Text",
                props: {
                  content: "Birth date: {{birthdate}}",
                  mode: "expression",
                  fontSize: 14,
                  textAlign: "center",
                  opacity: 0.6,
                  marginVertical: 4,
                },
              },
              {
                id: "hero-time-picker",
                type: "DatePicker",
                props: {
                  variableName: "wakeTime",
                  defaultValue: "1990-01-01T07:30:00.000Z",
                  mode: "time",
                  display: "spinner",
                  // 24h label (e.g. "07:30") via hour12: false
                  format: { hour: "2-digit", minute: "2-digit", hour12: false },
                  marginVertical: 8,
                },
              },
              {
                id: "waketime-display",
                type: "Text",
                props: {
                  content: "Wake time: {{wakeTime}}",
                  mode: "expression",
                  fontSize: 14,
                  textAlign: "center",
                  opacity: 0.6,
                  marginVertical: 4,
                },
              },
              {
                id: "hero-weight-wheel",
                type: "WheelPicker",
                props: {
                  variableName: "weight",
                  defaultValue: "70",
                  range: { min: 40, max: 200, step: 1, unit: "kg" },
                  height: 180,
                  marginVertical: 8,
                },
              },
              {
                id: "weight-display",
                type: "Text",
                props: {
                  content: "Weight: {{weight}}",
                  mode: "expression",
                  fontSize: 14,
                  textAlign: "center",
                  opacity: 0.6,
                  marginVertical: 4,
                },
              },
              {
                id: "hero-carousel",
                type: "Carousel",
                props: {
                  carouselType: "parallax",
                  autoPlay: false,
                  loop: true,
                  showDots: true,
                  dotColor: "#E9C46A",
                  activeDotColor: "#E76F51",
                  dotWidth: 8,
                  dotHeight: 8,
                  activeDotWidth: 24,
                  activeDotHeight: 8,
                  dotsGap: 8,
                  dotsPosition: "bottom",
                  dotsMarginTop: 12,
                  height: 220,
                  borderRadius: 16,
                  marginVertical: 8,
                  defaultIndex: 0,
                  variableName: "carouselPage",
                },
                children: [
                  {
                    id: "carousel-slide-1",
                    type: "Image",
                    props: {
                      url: "https://picsum.photos/400/220?random=10",
                      height: 220,
                      resizeMode: "cover",
                    },
                  },
                  {
                    id: "carousel-slide-2",
                    type: "Image",
                    props: {
                      url: "https://picsum.photos/400/220?random=11",
                      height: 220,
                      resizeMode: "cover",
                    },
                  },
                  {
                    id: "carousel-slide-3",
                    type: "Image",
                    props: {
                      url: "https://picsum.photos/400/220?random=12",
                      height: 220,
                      resizeMode: "cover",
                    },
                  },
                ],
              },
              {
                id: "carousel-page-label",
                type: "Text",
                props: {
                  content: "Carousel page: {{carouselPage}}",
                  mode: "expression",
                  fontSize: 14,
                  textAlign: "center",
                  opacity: 0.6,
                  marginVertical: 4,
                },
              },
              {
                id: "carousel-controls",
                type: "XStack",
                props: { gap: 8, marginVertical: 4 },
                children: [
                  {
                    id: "carousel-go-prev",
                    type: "Button",
                    props: {
                      label: "Prev",
                      variant: "outlined",
                      flex: 1,
                      actions: [
                        {
                          type: "setVariable",
                          name: "carouselPage",
                          value: "{{carouselPage}} - 1",
                          valueMode: "expression",
                        },
                      ],
                    },
                  },
                  {
                    id: "carousel-go-next",
                    type: "Button",
                    props: {
                      label: "Next",
                      variant: "outlined",
                      flex: 1,
                      actions: [
                        {
                          type: "setVariable",
                          name: "carouselPage",
                          value: "{{carouselPage}} + 1",
                          valueMode: "expression",
                        },
                      ],
                    },
                  },
                ],
              },
              {
                id: "zstack-demo",
                type: "ZStack",
                props: {
                  height: 200,
                  borderRadius: 16,
                  overflow: "hidden",
                  marginVertical: 8,
                },
                children: [
                  {
                    id: "zstack-bg",
                    type: "Image",
                    props: {
                      url: "https://picsum.photos/800/400?random=20",
                      height: 200,
                      resizeMode: "cover",
                    },
                  },
                  {
                    id: "zstack-overlay",
                    type: "YStack",
                    props: {
                      flex: 1,
                      backgroundColor: "rgba(0,0,0,0.45)",
                      padding: 20,
                      justifyContent: "flex-end",
                    },
                    children: [
                      {
                        id: "zstack-label",
                        type: "Text",
                        props: {
                          content: "ZStack: layered elements",
                          fontSize: 18,
                          fontWeight: "700",
                          color: "#fff",
                        },
                      },
                    ],
                  },
                ],
              },
              {
                id: "hero-button",
                type: "Button",
                props: {
                  label: "Get Started",
                  variant: "filled",
                  marginVertical: 8,
                  haptic: "medium",
                  actions: [
                    { type: "custom", function: "trackCta", variables: ["name", "plan", "goals"] },
                    "continue",
                  ],
                },
              },
              {
                id: "gradient-card",
                type: "YStack",
                props: {
                  padding: 20,
                  gap: 8,
                  borderRadius: 16,
                  overflow: "hidden",
                  marginVertical: 4,
                  backgroundGradient: {
                    type: "linear",
                    from: "topLeft",
                    to: "bottomRight",
                    stops: [
                      { color: "#6C63FF" },
                      { color: "#FF6584" },
                    ],
                  },
                },
                children: [
                  {
                    id: "gradient-card-title",
                    type: "Text",
                    props: { content: "Linear gradient", fontSize: 15, fontWeight: "700", color: "#fff" },
                  },
                  {
                    id: "gradient-card-body",
                    type: "Text",
                    props: { content: "topLeft → bottomRight", fontSize: 12, color: "#fff", opacity: 0.85 },
                  },
                ],
              },
              {
                id: "gradient-button",
                type: "Button",
                props: {
                  label: "Gradient Button",
                  variant: "filled",
                  marginVertical: 4,
                  backgroundGradient: {
                    type: "linear",
                    from: "left",
                    to: "right",
                    stops: [
                      { color: "#FF6584", position: 0 },
                      { color: "#6C63FF", position: 1 },
                    ],
                  },
                },
              },
              {
                id: "states-heading",
                type: "Text",
                props: {
                  content: "Button states & shadow",
                  fontSize: 13,
                  fontWeight: "700",
                  marginVertical: 4,
                  opacity: 0.5,
                },
              },
              {
                id: "btn-shadow",
                type: "Button",
                props: {
                  label: "Elevated (shadow)",
                  variant: "filled",
                  marginVertical: 4,
                  backgroundColor: "#6C63FF",
                  shadowColor: "#6C63FF",
                  shadowOffset: { width: 0, height: 6 },
                  shadowOpacity: 0.4,
                  shadowRadius: 12,
                  elevation: 8,
                },
              },
              {
                id: "btn-pressed",
                type: "Button",
                props: {
                  label: "Press me (hold)",
                  variant: "filled",
                  marginVertical: 4,
                  backgroundColor: "#10b981",
                  transitionDurationMs: 300,
                  pressedStyle: {
                    opacity: 0.6,
                    backgroundColor: "#065f46",
                  },
                },
              },
              {
                id: "btn-disabled",
                type: "Button",
                props: {
                  label: "Always disabled",
                  variant: "filled",
                  marginVertical: 4,
                  actions: ["continue"],
                  disabledWhen: {
                    variable: "never_enabled",
                    operator: "neq",
                    value: "yes",
                  },
                  disabledStyle: {
                    backgroundColor: "#fee2e2",
                    color: "#b91c1c",
                    borderRadius: 12,
                  },
                },
              },
              {
                id: "consent-toggle",
                type: "Button",
                props: {
                  label: "I agree to the terms",
                  variant: "outlined",
                  marginVertical: 8,
                  actions: [
                    { type: "setVariable", name: "consent_given", value: "yes", label: "Agreed" },
                  ],
                },
              },
              {
                id: "gated-continue",
                type: "Button",
                props: {
                  label: "Continue (gated)",
                  variant: "filled",
                  marginVertical: 4,
                  actions: ["continue"],
                  disabledWhen: {
                    variable: "consent_given",
                    operator: "neq",
                    value: "yes",
                  },
                  transitionDurationMs: 180,
                  shadowColor: "#000",
                  shadowOffset: { width: 0, height: 4 },
                  shadowOpacity: 0.18,
                  shadowRadius: 8,
                  elevation: 4,
                  pressedStyle: {
                    opacity: 0.7,
                    backgroundColor: "#4f46e5",
                  },
                  disabledStyle: {
                    backgroundColor: "#d1d5db",
                    color: "#6b7280",
                    shadowOpacity: 0,
                    elevation: 0,
                  },
                },
              },
            ],
          },
          ],
          },
            ],
          },
        ],
      },
      figmaUrl: null,
      customPayload: {},
      continueButtonLabel: "Continue",
    },
    {
      id: "ratings-app",
      name: "Rate the App",
      type: "Ratings",
      payload: {
        title: "Enjoying the app?",
        subtitle: "How do you rate our app?",
        socialProofs: [
          {
            content:
              "This app is amazing! It helped me get started quickly and the experience is so smooth.",
            authorName: "happyuser2024",
            numberOfStar: 5,
          },
        ],
        rateTheAppButtonLabel: "Rate the App",
      },
      figmaUrl: null,
      customPayload: {},
      continueButtonLabel: "Continue",
      displayProgressHeader: false,
    },
  ],
  configuration: {},
} satisfies Onboarding;
