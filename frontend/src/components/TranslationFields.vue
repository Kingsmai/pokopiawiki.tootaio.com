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
}>();

const emit = defineEmits<{
  'update:baseValue': [value: string];
  'update:translations': [value: TranslationMap];
}>();

const { t } = useI18n();
const visibleLanguages = computed(() => props.languages.filter((language) => language.enabled));
const defaultLanguage = computed(() => visibleLanguages.value.find((language) => language.isDefault) ?? visibleLanguages.value[0]);

function fieldValue(language: Language): string {
  if (language.code === defaultLanguage.value?.code) {
    return props.baseValue;
  }

  return props.translations[language.code]?.[props.field] ?? '';
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

function inputValue(event: Event): string {
  return event.target instanceof HTMLInputElement ? event.target.value : '';
}
</script>

<template>
  <div class="translation-fields">
    <div v-for="language in visibleLanguages" :key="language.code" class="field">
      <label :for="`${idPrefix}-${language.code}`">
        {{ t('common.fieldForLanguage', { field: label, language: language.name }) }}
      </label>
      <input
        :id="`${idPrefix}-${language.code}`"
        :value="fieldValue(language)"
        :required="required && language.code === defaultLanguage?.code"
        @input="updateField(language, inputValue($event))"
      />
    </div>
  </div>
</template>
