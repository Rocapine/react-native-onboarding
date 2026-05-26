import { UIElement } from "../types";
import { ComposableVariableEntry } from "../../../Provider/OnboardingProgressProvider";

/**
 * Walks the element tree and returns the initial variable map declared via
 * element-level defaults (`defaultIndex`, `defaultValue`, `defaultValues`).
 * Used by `Renderer` to overlay defaults onto `ctx.variables` so
 * `renderWhen` / expressions evaluate against them on first render — before
 * per-element seeding effects run.
 */
export function collectElementDefaults(
  elements: UIElement[]
): Record<string, ComposableVariableEntry> {
  const out: Record<string, ComposableVariableEntry> = {};
  const visit = (el: UIElement) => {
    switch (el.type) {
      case "Carousel": {
        const name = el.props.variableName;
        if (name && el.props.defaultIndex != null) {
          // Mirror CarouselElementComponent's clampIndex so the overlaid default
          // matches the index the carousel actually mounts at.
          const raw = Number(el.props.defaultIndex);
          const safe = Number.isFinite(raw) ? raw : 0;
          const maxIdx = Math.max(0, el.children.length - 1);
          const clamped = Math.max(0, Math.min(safe, maxIdx));
          out[name] = { value: String(clamped) };
        }
        el.children.forEach(visit);
        break;
      }
      case "RadioGroup": {
        const name = el.props.variableName;
        const dv = el.props.defaultValue;
        if (name && dv !== undefined) {
          const item = el.props.items.find((i) => i.value === dv);
          out[name] = { value: dv, label: item?.label };
        }
        break;
      }
      case "CheckboxGroup": {
        const name = el.props.variableName;
        const dvs = el.props.defaultValues;
        if (name && dvs !== undefined) {
          const labels = dvs.map(
            (dv) => el.props.items.find((i) => i.value === dv)?.label ?? dv
          );
          out[name] = { value: JSON.stringify(dvs), label: labels.join(", ") };
        }
        break;
      }
      case "Input": {
        const name = el.props.variableName;
        if (name && el.props.defaultValue !== undefined) {
          out[name] = { value: el.props.defaultValue };
        }
        break;
      }
      case "DatePicker": {
        const name = el.props.variableName;
        if (name && el.props.defaultValue !== undefined) {
          const d = new Date(el.props.defaultValue);
          if (!isNaN(d.getTime())) out[name] = { value: d.toISOString() };
        }
        break;
      }
      case "YStack":
      case "XStack":
      case "ZStack":
      case "SafeAreaView":
        el.children.forEach(visit);
        break;
    }
  };
  elements.forEach(visit);
  return out;
}
