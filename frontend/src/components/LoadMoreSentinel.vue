<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';

const props = withDefaults(
  defineProps<{
    active: boolean;
    disabled?: boolean;
    rootMargin?: string;
  }>(),
  {
    disabled: false,
    rootMargin: '360px 0px'
  }
);

const emit = defineEmits<{
  load: [];
}>();

const sentinel = ref<HTMLElement | null>(null);
let observer: IntersectionObserver | null = null;

function disconnectObserver() {
  observer?.disconnect();
  observer = null;
}

function observeSentinel() {
  disconnectObserver();

  if (!props.active || props.disabled || !sentinel.value) {
    return;
  }

  if (typeof IntersectionObserver === 'undefined') {
    emit('load');
    return;
  }

  observer = new IntersectionObserver(
    (entries) => {
      if (entries.some((entry) => entry.isIntersecting)) {
        emit('load');
      }
    },
    { rootMargin: props.rootMargin }
  );
  observer.observe(sentinel.value);
}

onMounted(() => {
  void nextTick(observeSentinel);
});

onBeforeUnmount(disconnectObserver);

watch(
  () => [props.active, props.disabled, props.rootMargin, sentinel.value],
  () => {
    void nextTick(observeSentinel);
  },
  { flush: 'post' }
);
</script>

<template>
  <div v-if="active" ref="sentinel" class="load-more-sentinel" aria-hidden="true"></div>
</template>
