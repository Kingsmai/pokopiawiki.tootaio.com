<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import type { Language, TranslationField, TranslationMap } from '../services/api';

const props = defineProps<{
  idPrefix: string;
  field: TranslationField;
  label: string;
  baseValue: string;
  translations: TranslationMap;
  languages: Language[];
  required?: boolean;
  multiline?: boolean;
  rows?: number;
}>();

const emit = defineEmits<{
  'update:baseValue': [value: string];
  'update:translations': [value: TranslationMap];
}>();

const { locale, t } = useI18n();
const fallbackLanguage: Language = { code: 'en', name: 'English', enabled: true, isDefault: true, sortOrder: 0 };
const visibleLanguages = computed(() => props.languages.filter((language) => language.enabled));
const defaultLanguage = computed(() => visibleLanguages.value.find((language) => language.isDefault) ?? visibleLanguages.value[0] ?? fallbackLanguage);
const currentLanguage = computed(() => {
  const currentLocale = String(locale.value || defaultLanguage.value.code);
  return visibleLanguages.value.find((language) => language.code === currentLocale) ?? defaultLanguage.value;
});
const isDefaultLanguage = computed(() => currentLanguage.value.code === defaultLanguage.value.code);
const currentValue = computed({
  get: () => fieldValue(currentLanguage.value),
  set: (value: string) => updateField(currentLanguage.value, value)
});
const currentPlaceholder = computed(() => fieldPlaceholder(currentLanguage.value));
const currentRequired = computed(() => Boolean(props.required && (isDefaultLanguage.value || props.baseValue.trim() === '')));

function fieldValue(language: Language): string {
  if (language.code === defaultLanguage.value?.code) {
    return props.baseValue;
  }

  return props.translations[language.code]?.[props.field] ?? '';
}

function fieldPlaceholder(language: Language): string {
  return language.code === defaultLanguage.value?.code ? '' : props.baseValue;
}

function updateField(language: Language, value: string) {
  if (language.code === defaultLanguage.value?.code) {
    emit('update:baseValue', value);
    return;
  }

  const nextTranslations: TranslationMap = { ...props.translations };
  const nextFields = { ...(nextTranslations[language.code] ?? {}) };

  if (value.trim() === '') {
    delete nextFields[props.field];
  } else {
    nextFields[props.field] = value;
  }

  if (Object.keys(nextFields).length) {
    nextTranslations[language.code] = nextFields;
  } else {
    delete nextTranslations[language.code];
  }

  emit('update:translations', nextTranslations);
}

</script>

<template>
  <div class="translation-fields">
    <div class="field">
      <label :for="`${idPrefix}-${currentLanguage.code}`">
        {{ t('common.fieldForLanguage', { field: label, language: currentLanguage.name }) }}
      </label>
      <input
        v-if="!multiline"
        :id="`${idPrefix}-${currentLanguage.code}`"
        v-model="currentValue"
        :placeholder="currentPlaceholder"
        :required="currentRequired"
      />
      <textarea
        v-else
        :id="`${idPrefix}-${currentLanguage.code}`"
        v-model="currentValue"
        :placeholder="currentPlaceholder"
        :required="currentRequired"
        :rows="rows ?? 4"
      ></textarea>
    </div>
  </div>
</template>
