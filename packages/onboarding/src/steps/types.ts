import { CarouselStepType } from "./Carousel/types";
import { CommitmentStepType } from "./Commitment/types";
import { LoaderStepType } from "./Loader/types";
import { MediaContentStepType } from "./MediaContent/types";
import { ComposableScreenStepType } from "./ComposableScreen/types";
import { PickerStepType } from "./Picker/types";
import { QuestionStepType } from "./Question/types";
import { RatingsStepType } from "./Ratings/types";

export type OnboardingStepType =
  | CarouselStepType
  | CommitmentStepType
  | LoaderStepType
  | MediaContentStepType
  | ComposableScreenStepType
  | PickerStepType
  | QuestionStepType
  | RatingsStepType;
