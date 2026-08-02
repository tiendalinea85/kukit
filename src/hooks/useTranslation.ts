import { useAppStore } from "@/stores/useAppStore";
import { t } from "@/lib/translations";

export function useTranslation() {
  const language = useAppStore((s) => s.language);
  return {
    t: (path: string) => t(language, path),
    language,
  };
}
