import { ColorValue } from "react-native";

const MediaContent = "MediaContent";
const Question = "Question";
const Picker = "Picker";
const CustomScreen = "CustomScreen";
const Carousel = "Carousel";
const Reminder = "Reminder";
const CreatingProfileLoader = "CreatingProfileLoader";

export const STEP_TYPES = {
  MediaContent,
  Question,
  Picker,
  CustomScreen,
  Carousel,
  Reminder,
  CreatingProfileLoader,
} as const;

type BaseStepProperties = {
  id: string;
  type:
    | typeof MediaContent
    | typeof Question
    | typeof Picker
    | typeof CustomScreen
    | typeof Carousel
    | typeof Reminder
    | typeof CreatingProfileLoader;
  name: string;
  displayProgressHeader: boolean;
  payload: Record<string, any>;
  customPayload?: Record<string, any>;
};

export type StepType = BaseStepProperties["type"];

export type MediaSource = {
  type: "video" | "image" | "lottie" | "rive";
} & (
  | {
      localPathId: string;
    }
  | {
      url: string;
    }
);

export interface MediaContentStepType extends BaseStepProperties {
  type: typeof MediaContent;
  payload: {
    mediaSource: MediaSource;
    title: string;
    description: string;
    socialProof?: {
      numberOfStar: number;
      content: string;
      authorName: string;
    };
  };
}

export type Answer = {
  label: string;
  value: string;
  icon?: string;
  description?: string;
};

export interface QuestionStepType extends BaseStepProperties {
  type: typeof Question;
  payload: {
    answers: Answer[];
    title: string;
    subtitle?: string;
    multipleAnswer: boolean;
    infoBox?: {
      title: string;
      content: string;
    };
  };
}

export enum PickerType {
  Name = "name",
  Date = "date",
  Height = "height",
  Weight = "weight",
  Age = "age",
  Gender = "gender",
  Coach = "coach",
}

export interface PickerStepType extends BaseStepProperties {
  type: typeof Picker;
  payload: {
    title: string;
    description?: string;
    pickerType: PickerType;
  };
}

export interface CustomScreenStepType extends BaseStepProperties {
  type: typeof CustomScreen;
  payload: {
    customScreenId: string;
    type: string;
  };
}

export interface CarouselScreenType {
  mediaUrl: string;
  title: string;
  subtitle: string;
}

export type CarouselCustomPayloadScreenType = Omit<
  CarouselScreenType,
  "mediaUrl"
> & {
  description?: string;
  backgroundColor: ColorValue;
  titleColor?: ColorValue;
  subtitleColor?: ColorValue;
  descriptionColor?: ColorValue;
  mediaSource: MediaSource;
  textRuns?: Record<string, string>;
  storyDuration?: number;
};

export interface CarouselStepType extends BaseStepProperties {
  type: typeof Carousel;
  payload: {
    screens: CarouselScreenType[];
  };
  customPayload?: {
    type?: "default" | "story";
    screens: CarouselCustomPayloadScreenType[];
    defaultStoryDuration?: number;
  };
}

export interface ReminderStepType extends BaseStepProperties {
  type: typeof Reminder;
  payload: {
    title: string;
    subtitle: string;
  };
}

export interface CreatingProfileLoaderStepType extends BaseStepProperties {
  type: typeof CreatingProfileLoader;
  payload: {
    title: string;
    progressBars: {
      loadedLabel: string;
      loadingLabel: string;
    }[];
  };
}

export type OnboardingStep =
  | MediaContentStepType
  | QuestionStepType
  | PickerStepType
  | CustomScreenStepType
  | CarouselStepType
  | ReminderStepType
  | CreatingProfileLoaderStepType;
