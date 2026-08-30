<script setup lang="ts">
import { ref } from 'vue';

import { N8nButton, N8nInput, N8nInputLabel } from '@n8n/design-system';
import { useI18n } from '@n8n/i18n';

import Modal from '@/app/components/Modal.vue';
import { VOYAGR_FEEDBACK_MODAL_KEY } from '@/app/constants';
import { useToast } from '@/app/composables/useToast';
import { useUIStore } from '@/app/stores/ui.store';

import { submitFeedback } from '../feedback.api';

const i18n = useI18n();
const toast = useToast();
const uiStore = useUIStore();

const text = ref('');
const submitting = ref(false);

async function onSubmit(): Promise<void> {
	if (text.value.trim() === '' || submitting.value) return;

	submitting.value = true;

	try {
		await submitFeedback(text.value);

		toast.showMessage({ title: i18n.baseText('voyagr.feedback.thanks'), type: 'success' });
		text.value = '';
		uiStore.closeModal(VOYAGR_FEEDBACK_MODAL_KEY);
	} catch (error) {
		// Keep the text and the modal open so the person can retry without retyping.
		toast.showError(error, i18n.baseText('voyagr.feedback.error'));
	} finally {
		submitting.value = false;
	}
}
</script>

<template>
	<Modal
		:name="VOYAGR_FEEDBACK_MODAL_KEY"
		:title="i18n.baseText('voyagr.feedback.title')"
		:subtitle="i18n.baseText('voyagr.feedback.subtitle')"
		width="480px"
		data-test-id="voyagr-feedback-modal"
	>
		<template #content>
			<N8nInputLabel :label="i18n.baseText('voyagr.feedback.title')" input-name="voyagr-feedback">
				<N8nInput
					id="voyagr-feedback"
					v-model="text"
					name="voyagr-feedback"
					type="textarea"
					:rows="5"
					:placeholder="i18n.baseText('voyagr.feedback.placeholder')"
					:disabled="submitting"
					data-test-id="voyagr-feedback-input"
				/>
			</N8nInputLabel>
		</template>

		<template #footer>
			<N8nButton
				:label="i18n.baseText('voyagr.feedback.submit')"
				:disabled="text.trim() === ''"
				:loading="submitting"
				data-test-id="voyagr-feedback-submit"
				@click="onSubmit"
			/>
		</template>
	</Modal>
</template>
