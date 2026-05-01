<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRoute } from 'vue-router';
import PageHeader from '../components/PageHeader.vue';
import Skeleton from '../components/Skeleton.vue';
import StatusMessage from '../components/StatusMessage.vue';
import { api } from '../services/api';

const route = useRoute();
const busy = ref(true);
const message = ref('');
const errorMessage = ref('');
const { t } = useI18n();

onMounted(async () => {
  const token = typeof route.query.token === 'string' ? route.query.token : '';

  if (!token) {
    busy.value = false;
    errorMessage.value = t('auth.invalidVerification');
    return;
  }

  try {
    const response = await api.verifyEmail(token);
    message.value = response.message;
  } catch (error) {
    errorMessage.value = error instanceof Error && error.message ? error.message : t('auth.verifyFailed');
  } finally {
    busy.value = false;
  }
});
</script>

<template>
  <section class="auth-page">
    <div class="auth-panel">
      <PageHeader :title="t('auth.verifyTitle')" :subtitle="t('auth.verifySubtitle')">
        <template #kicker>Trainer Pass</template>
      </PageHeader>

      <div v-if="busy" class="skeleton-auth-state" aria-busy="true" :aria-label="t('auth.verifyingEmail')">
        <Skeleton width="62%" />
        <Skeleton width="84%" />
        <Skeleton variant="box" width="110px" height="44px" />
      </div>
      <StatusMessage v-else-if="message" variant="success">{{ message }}</StatusMessage>
      <StatusMessage v-else variant="danger">{{ errorMessage }}</StatusMessage>

      <RouterLink v-if="!busy" class="ui-button ui-button--primary" to="/login">{{ t('auth.goLogin') }}</RouterLink>
    </div>
  </section>
</template>
