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
                  autoplay: true,
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
