<script setup lang="ts">
import { provide, shallowRef } from 'vue';
import { WorkflowDocumentStoreKey } from '@/app/constants/injectionKeys';
import { makeFakeWorkflowDocumentStore } from './store-stub';
import TravelCanvas from './TravelCanvas.vue';

// Provide the fake store in an ANCESTOR so both TravelCanvas and its child <Canvas>
// resolve it via inject (and never fall back to n8n's global workflow store).
provide(WorkflowDocumentStoreKey, shallowRef(makeFakeWorkflowDocumentStore()));
</script>

<template>
	<TravelCanvas />
</template>
