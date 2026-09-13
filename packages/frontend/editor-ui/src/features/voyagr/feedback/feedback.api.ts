/**
 * Where feedback would go.
 *
 * Deliberately blank: the form exists so travellers have somewhere to put a
 * thought, but there is no collector yet. Nothing is sent, nothing is stored,
 * and the submitted text is discarded — do not assume a backlog exists
 * somewhere. Fill this in and swap the body below for a real request when
 * there is an endpoint to receive it.
 */
const FEEDBACK_ENDPOINT = '';

export async function submitFeedback(_text: string): Promise<void> {
	if (FEEDBACK_ENDPOINT === '') return;

	// TODO: POST the feedback once FEEDBACK_ENDPOINT points somewhere.
}
