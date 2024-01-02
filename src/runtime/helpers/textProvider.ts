import { type ComputedRef, computed } from 'vue'
import { translations } from '#blokkli/translations'
import type { AdapterContext } from '../adapter'
import enTranslations from './../../translations/en'

type ValidTextKeys = keyof typeof enTranslations

export type TextProvider = (key: ValidTextKeys) => string

export default function (
  context?: ComputedRef<AdapterContext>,
): TextProvider {
  const defaultLanguage = useRuntimeConfig().public.blokkli
    .defaultLanguage as keyof typeof translations
  const language = computed(() => {
    if (
      context?.value.language &&
      (translations as any)[context.value.language]
    ) {
      return context.value.language as keyof typeof translations
    }
    return defaultLanguage
  })
  const currentTranslations = computed(() => {
    return translations[language.value] as any
  })
  return (key: ValidTextKeys) => {
    return currentTranslations.value[key] || translations.en[key]
  }
}
