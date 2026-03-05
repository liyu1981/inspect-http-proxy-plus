"use client";

import { FileRenderer, fileRenderer } from "./file-renderer";
import { ImageRenderer, imageRenderer } from "./image-renderer";
import { JsonRenderer, jsonRenderer } from "./json-renderer";
import {
	OllamaStreamRenderer,
	ollamaStreamRenderer,
} from "./ollama-stream-renderer";
import {
	OpenAiEventStreamRenderer,
	openAiEventStreamRenderer,
} from "./openai-event-stream-renderer";
import type { BodyRenderer, BodyRendererProps } from "./types";
import { ZipRenderer, zipRenderer } from "./zip-renderer";

/** Registered body renderer plugins */
const renderers: BodyRenderer[] = [
	jsonRenderer,
	imageRenderer,
	zipRenderer,
	openAiEventStreamRenderer,
	ollamaStreamRenderer,
	fileRenderer,
];

/**
 * Find the best renderer for a given content type and body.
 * Sorted by priority descending.
 */
export function findRenderer(
	contentType: string,
	body: string,
): BodyRenderer | undefined {
	return renderers
		.filter((r) => r.match(contentType, body))
		.sort((a, b) => (b.priority || 0) - (a.priority || 0))[0];
}

/**
 * Get all available renderers for a given content type and body.
 * For now, we only use the primary one, but this allows future multi-view support.
 */
export function getAllAvailableRenderers(
	contentType: string,
	body: string,
): BodyRenderer[] {
	return renderers
		.filter((r) => r.match(contentType, body))
		.sort((a, b) => (b.priority || 0) - (a.priority || 0));
}

export const AdaptiveBodyRenderer: React.FC<BodyRendererProps> = ({
	body,
	contentType,
}) => {
	let e = <div></div>;

	switch (contentType) {
		case "file":
			e = <FileRenderer body={body} contentType={contentType} />;
			break;
		case "image":
			e = <ImageRenderer body={body} contentType={contentType} />;
			break;
		case "json":
			e = <JsonRenderer body={body} contentType={contentType} />;
			break;
		case "ollama-stream":
			e = <OllamaStreamRenderer body={body} contentType={contentType} />;
			break;
		case "openai-event-stream":
			e = <OpenAiEventStreamRenderer body={body} contentType={contentType} />;
			break;
		case "zip":
			e = <ZipRenderer body={body} contentType={contentType} />;
			break;
	}

	return e;
};
