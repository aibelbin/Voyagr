import { Logger } from '@n8n/backend-common';
import type { AuthenticatedRequest } from '@n8n/db';
import { Body, Post, RestController } from '@n8n/decorators';

import { WorkflowCreationService } from '@/workflows/workflow-creation.service';
import { createWorkflowEntityFromPayload } from '@/workflows/workflow-entity-mapper';

import { buildTripWorkflow } from './build-trip-workflow';
import { GeneratorService } from './generator.service';
import { TripGenerationRequestDto } from './trip-generation-request.dto';

@RestController('/voyagr')
export class GeneratorController {
	constructor(
		private readonly generatorService: GeneratorService,
		private readonly workflowCreationService: WorkflowCreationService,
		private readonly logger: Logger,
	) {}

	/**
	 * Generates three itineraries and saves them as one trip whose branches the
	 * traveller can compare and prune.
	 *
	 * No scope decorator: the trip lands in the caller's own personal project,
	 * and `WorkflowCreationService` checks `workflow:create` there itself. A
	 * decorator here would only turn that into a 403 the form cannot render.
	 *
	 * Always answers 200. `workflowId: null` means generation could not run —
	 * no key, no places, a refusal, a model error, or a trip that would not
	 * save — and the form shows one quiet message rather than an error.
	 * Planning by hand never depends on this.
	 */
	@Post('/generate-trip')
	async generateTrip(
		req: AuthenticatedRequest,
		_res: unknown,
		@Body body: TripGenerationRequestDto,
	): Promise<{ workflowId: string | null }> {
		const result = await this.generatorService.generate(body);
		if (!result) return { workflowId: null };

		const { nodes, connections } = buildTripWorkflow(body, result.options, result.placesById);

		// Only the trigger survived, so every place the model named was one we
		// never offered it. Nothing worth showing a traveller.
		if (nodes.length <= 1) return { workflowId: null };

		try {
			const created = await this.workflowCreationService.createWorkflow(
				req.user,
				createWorkflowEntityFromPayload({ name: body.destination, nodes, connections }),
			);

			return { workflowId: created.id };
		} catch (error) {
			this.logger.warn('Saving a generated trip failed', { error });

			return { workflowId: null };
		}
	}
}
