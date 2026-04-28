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
                  height: 180,
                  autoPlay: true,
                  fit: "Contain",
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
                },
              },
              {
                id: "hero-icon",
                type: "Icon",
                props: {
                  name: "Star",
                  size: 48,
                  color: "#007AFF",
                  marginVertical: 8,
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
                },
              },
              {
                id: "hero-input",
                type: "Input",
                props: {
                  variableName: "name",
                  placeholder: "Enter your name",
                  keyboardType: "default",
                  returnKeyType: "done",
                  autoCapitalize: "words",
                  marginVertical: 8,
                },
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
                  fontFamily: "System",
                  textAlign: "center",
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
                  gap: 8,
                  marginVertical: 8,
                  items: [
                    { label: "Monthly", value: "monthly" },
                    { label: "Yearly", value: "yearly" },
                    { label: "Lifetime", value: "lifetime" },
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
                id: "hero-checkbox",
                type: "CheckboxGroup",
                props: {
                  variableName: "goals",
                  defaultValues: ["health", "fitness"],
                  gap: 8,
                  marginVertical: 8,
                  items: [
                    { label: "Improve health", value: "health" },
                    { label: "Build fitness", value: "fitness" },
                    { label: "Lose weight", value: "weight" },
                    { label: "Gain muscle", value: "muscle" },
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
                  maximumDate: new Date().toISOString(), // static at module load time — suitable for demo; use a runtime value in production
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
                id: "hero-carousel",
                type: "Carousel",
                props: {
                  carouselType: "parallax",
                  autoPlay: true,
                  autoPlayInterval: 3000,
                  loop: true,
                  showDots: true,
                  height: 220,
                  borderRadius: 16,
                  marginVertical: 8,
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
