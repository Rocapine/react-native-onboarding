import { z } from "zod";
import { BaseBoxProps, BaseBoxPropsSchema } from "./BaseBoxProps";

export type RiveElementProps = BaseBoxProps & {
  url: string;
  autoplay?: boolean;
  fit?: "Contain" | "Cover" | "Fill" | "FitWidth" | "FitHeight" | "None" | "ScaleDown" | "Layout";
  alignment?: "TopLeft" | "TopCenter" | "TopRight" | "CenterLeft" | "Center" | "CenterRight" | "BottomLeft" | "BottomCenter" | "BottomRight";
  artboardName?: string;
  stateMachineName?: string;
};

export const RiveElementPropsSchema = BaseBoxPropsSchema.extend({
  url: z.string(),
  autoplay: z.boolean().optional(),
  fit: z.enum(["Contain", "Cover", "Fill", "FitWidth", "FitHeight", "None", "ScaleDown", "Layout"]).optional(),
  alignment: z.enum(["TopLeft", "TopCenter", "TopRight", "CenterLeft", "Center", "CenterRight", "BottomLeft", "BottomCenter", "BottomRight"]).optional(),
  artboardName: z.string().optional(),
  stateMachineName: z.string().optional(),
});
