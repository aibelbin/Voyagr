import { createTestingPinia } from '@pinia/testing';
import { fireEvent, waitFor } from '@testing-library/vue';

import { createComponentRenderer } from '@/__tests__/render';
import { VOYAGR_FEEDBACK_MODAL_KEY } from '@/app/constants';
import { useUIStore } from '@/app/stores/ui.store';

const submitFeedback = vi.fn();
vi.mock('../feedback.api', () => ({
	submitFeedback: (text: string) => submitFeedback(text) as Promise<void>,
}));

const showMessage = vi.fn();
const showError = vi.fn();
vi.mock('@/app/composables/useToast', () => ({
	useToast: () => ({
		showMessage,
		showError,
		showToast: vi.fn(),
	}),
}));

import FeedbackModal from './FeedbackModal.vue';

// Modal.vue mounts through element-plus' ElDialog, which needs real store
// wiring to render its body. Stub it down to its slots, the same way other
// n8n modal tests (e.g. ImportWorkflowUrlModal.test.ts) do, so we can assert
// on this component's own content instead of ElDialog's mount behaviour.
const ModalStub = {
	template: `
		<div>
			<slot name="header" />
			<slot name="title" />
			<slot name="content" />
			<slot name="footer" />
		</div>
	`,
};

const global = {
	stubs: {
		Modal: ModalStub,
	},
};

const initialState = {
	modalsById: {
		[VOYAGR_FEEDBACK_MODAL_KEY]: { open: true },
	},
	modalStack: [VOYAGR_FEEDBACK_MODAL_KEY],
};

const renderModal = createComponentRenderer(FeedbackModal);
let pinia: ReturnType<typeof createTestingPinia>;

describe('FeedbackModal', () => {
	beforeEach(() => {
		pinia = createTestingPinia({ initialState });
		submitFeedback.mockReset();
		showMessage.mockReset();
		showError.mockReset();
	});

	it('disables the submit button for empty and whitespace-only input', async () => {
		const { getByTestId } = renderModal({ global, pinia });

		const input = getByTestId('voyagr-feedback-input');
		const button = getByTestId('voyagr-feedback-submit');

		expect(button).toBeDisabled();

		await fireEvent.update(input, '   ');
		expect(button).toBeDisabled();

		await fireEvent.update(input, '  Loved the trip planner  ');
		expect(button).toBeEnabled();
	});

	it('shows the thanks toast, clears the field, and closes the modal on a successful submit', async () => {
		submitFeedback.mockResolvedValue(undefined);

		const { getByTestId } = renderModal({ global, pinia });
		const uiStore = useUIStore();

		const input = getByTestId('voyagr-feedback-input') as HTMLTextAreaElement;
		const button = getByTestId('voyagr-feedback-submit');

		await fireEvent.update(input, 'Loved the trip planner');
		await fireEvent.click(button);

		await waitFor(() => expect(showMessage).toHaveBeenCalled());

		expect(submitFeedback).toHaveBeenCalledWith('Loved the trip planner');
		expect(showMessage).toHaveBeenCalledWith({
			title: 'Thanks for the feedback.',
			type: 'success',
		});
		expect(showError).not.toHaveBeenCalled();
		expect(input.value).toBe('');
		expect(uiStore.closeModal).toHaveBeenCalledWith(VOYAGR_FEEDBACK_MODAL_KEY);
	});

	it('shows an error toast and leaves the text and modal in place on a failing submit', async () => {
		const error = new Error('network down');
		submitFeedback.mockRejectedValue(error);

		const { getByTestId } = renderModal({ global, pinia });
		const uiStore = useUIStore();

		const input = getByTestId('voyagr-feedback-input') as HTMLTextAreaElement;
		const button = getByTestId('voyagr-feedback-submit');

		await fireEvent.update(input, 'This crashed on me');
		await fireEvent.click(button);

		await waitFor(() => expect(showError).toHaveBeenCalled());

		expect(showError).toHaveBeenCalledWith(
			error,
			"Couldn't send your feedback. You can try again.",
		);
		expect(showMessage).not.toHaveBeenCalled();
		// The person's words survive a failed send so they can retry.
		expect(input.value).toBe('This crashed on me');
		expect(uiStore.closeModal).not.toHaveBeenCalled();
	});

	it('does not allow a second submit while one is already in flight', async () => {
		let resolveSubmit: () => void = () => {};
		submitFeedback.mockImplementation(
			async () =>
				await new Promise<void>((resolve) => {
					resolveSubmit = resolve;
				}),
		);

		const { getByTestId } = renderModal({ global, pinia });

		const input = getByTestId('voyagr-feedback-input') as HTMLTextAreaElement;
		const button = getByTestId('voyagr-feedback-submit');

		await fireEvent.update(input, 'Double click me');

		// Two synchronous clicks, before Vue has a chance to re-render the
		// disabled state, exercise the in-flight guard itself rather than the
		// button's disabled attribute.
		button.click();
		button.click();

		expect(submitFeedback).toHaveBeenCalledTimes(1);

		resolveSubmit();
		await waitFor(() => expect(showMessage).toHaveBeenCalled());
	});
});
