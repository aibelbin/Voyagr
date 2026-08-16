import type { TripGenerationRequest } from '@n8n/api-types';
import type { IRestApiContext } from '@n8n/rest-api-client';
import { makeRestApiRequest } from '@n8n/rest-api-client';

export async function generateTrip(
	context: IRestApiContext,
	request: TripGenerationRequest,
): Promise<{ workflowId: string | null }> {
	return await makeRestApiRequest<{ workflowId: string | null }>(
		context,
		'POST',
		'/voyagr/generate-trip',
		request,
	);
}
