import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
} from "react";
import {
  createJSONEditor,
  type JSONEditorPropsOptional,
  Mode,
  type JsonEditor as VanillaJsonEditor,
} from "vanilla-jsoneditor";

function tryParseJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

function debounce<T extends unknown[]>(
  fn: (...args: T) => void,
  delay: number,
) {
  let timer: ReturnType<typeof setTimeout>;
  function debounced(...args: T) {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  }
  debounced.cancel = () => clearTimeout(timer);
  return debounced;
}

const BOOL_ATTRS = [
  "mainMenuBar",
  "navigationBar",
  "statusBar",
  "askToFormat",
  "readOnly",
  "escapeControlCharacters",
  "escapeUnicodeCharacters",
  "flattenColumns",
] as const;

type BoolAttr = (typeof BOOL_ATTRS)[number];

type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue };

interface Parser {
  parse: (text: string) => unknown;
  stringify: (value: unknown) => string;
}

export interface JsonEditorProps
  extends Omit<
    JSONEditorPropsOptional,
    "mode" | "onChange" | "onChangeMode" | "parser"
  > {
  initialJson?: JsonValue;
  onChangeJson?: (value: JsonValue | undefined) => void;
  debounce?: number;
  stringified?: boolean;
  parser?: Parser;
}

export interface JsonEditorRef {
  jsonEditor: VanillaJsonEditor | null;
}

/**
 * JsonEditor
 *
 * Props:
 *   initialJson    — initial value (string | object | array | undefined)
 *   onChangeJson   — called with the new value whenever the editor changes
 *   debounce       — debounce ms for text-mode changes (default: 300)
 *   stringified    — when true, strings are kept as text; false = parse them (default: true)
 *   parser         — custom { parse, stringify } (default: JSON.parse / JSON.stringify)
 *   ...boolAttrs   — mainMenuBar, navigationBar, statusBar, askToFormat,
 *                    readOnly, escapeControlCharacters, escapeUnicodeCharacters, flattenColumns
 *   ...rest        — any other vanilla-jsoneditor props (passed through)
 *
 * Ref:
 *   Exposes { jsonEditor } — the raw vanilla-jsoneditor instance
 */
export const JsonEditor = forwardRef<JsonEditorRef, JsonEditorProps>(
  function JsonEditor(
    {
      initialJson,
      onChangeJson,
      debounce: debounceProp,
      stringified: stringifiedProp,
      parser: parserProp,
      ...rest
    },
    ref,
  ) {
    const containerRef = useRef<HTMLDivElement>(null);
    const editorRef = useRef<VanillaJsonEditor | null>(null);
    const preventUpdatingRef = useRef(false);
    const parseRef = useRef<(text: string) => unknown>(tryParseJson);

    // Expose the raw editor instance via ref
    useImperativeHandle(ref, () => ({ jsonEditor: editorRef.current }), []);

    const resolveDebounce = useCallback(
      () => debounceProp ?? 300,
      [debounceProp],
    );
    const resolveStringified = useCallback(
      () => stringifiedProp ?? true,
      [stringifiedProp],
    );

    // Build the initial content object from a raw value
    const buildContent = useCallback(
      (val: JsonValue | undefined) => {
        if (val === undefined || val === "") return { text: "" };
        const useText = typeof val === "string" && resolveStringified();
        return { [useText ? "text" : "json"]: val };
      },
      [resolveStringified],
    );

    // Debounced emitter — rebuilt when delay or stringified changes
    const debouncedHandleChangeRef = useRef<ReturnType<typeof debounce> | null>(
      null,
    );
    useEffect(() => {
      const delay = resolveDebounce();
      const stringified = resolveStringified();

      const emit = (content: { text?: string; json?: unknown }) => {
        preventUpdatingRef.current = true;
        const mutableContent = { ...content };
        if (!stringified && mutableContent.text !== undefined) {
          if (editorRef.current && !editorRef.current.validate()) {
            mutableContent.json = parseRef.current(mutableContent.text);
          }
          mutableContent.text = undefined;
        }
        onChangeJson?.(
          (mutableContent.text === undefined
            ? mutableContent.json
            : mutableContent.text) as JsonValue | undefined,
        );
      };

      debouncedHandleChangeRef.current = debounce(emit, delay) as any;
    }, [onChangeJson, resolveDebounce, resolveStringified]);

    // Mount the editor once
    // biome-ignore lint/correctness/useExhaustiveDependencies: rest is not usable
    useEffect(() => {
      if (!containerRef.current) return;

      parseRef.current = parserProp?.parse ?? tryParseJson;

      // Collect bool attrs
      const resolvedBoolAttrs: Partial<Record<BoolAttr, boolean>> = {};
      BOOL_ATTRS.forEach((attr) => {
        const val = (rest as Record<string, unknown>)[attr];
        if (val !== undefined) resolvedBoolAttrs[attr] = val as boolean;
      });

      // Collect extra pass-through attrs
      const extraAttrs: Record<string, unknown> = {};
      Object.keys(rest).forEach((k) => {
        if (!(BOOL_ATTRS as readonly string[]).includes(k))
          extraAttrs[k] = (rest as Record<string, unknown>)[k];
      });

      const initialContent = buildContent(initialJson);

      const editorProps: JSONEditorPropsOptional = {
        mode: Mode.text,
        parser: {
          parse: tryParseJson,
          stringify: JSON.stringify,
        },
        content: ((Object.keys(initialContent).length > 0 &&
          (initialContent as { text?: string }).text !== "") ||
        (initialContent as { json?: unknown }).json !== undefined
          ? initialContent
          : { text: "" }) as any,
        onChange: (updatedContent) => {
          const mutableContent = { ...updatedContent } as {
            text?: string;
            json?: unknown;
          };
          debouncedHandleChangeRef.current?.(mutableContent);
        },
        ...resolvedBoolAttrs,
        ...extraAttrs,
      };

      editorRef.current = createJSONEditor({
        target: containerRef.current,
        props: editorProps,
      });

      return () => {
        editorRef.current?.destroy();
        editorRef.current = null;
      };
      // Only run on mount
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [buildContent, initialJson, parserProp?.parse]);

    // Sync external initialJson changes into the editor
    useEffect(() => {
      if (!editorRef.current) return;
      if (preventUpdatingRef.current) {
        preventUpdatingRef.current = false;
        return;
      }
      editorRef.current.set(buildContent(initialJson) as any);
    }, [initialJson, buildContent]);

    // Sync bool attr changes
    useEffect(
      () => {
        if (!editorRef.current) return;
        const updates: Partial<Record<BoolAttr, boolean>> = {};
        BOOL_ATTRS.forEach((attr) => {
          const val = (rest as Record<string, unknown>)[attr];
          if (val !== undefined) updates[attr] = val as boolean;
        });
        if (Object.keys(updates).length > 0)
          editorRef.current.updateProps(updates);
        // eslint-disable-next-line react-hooks/exhaustive-deps
      },
      // biome-ignore lint/correctness/useExhaustiveDependencies: BOOL_ATTRS is constant
      BOOL_ATTRS.map((attr) => (rest as Record<string, unknown>)[attr]),
    );

    // Sync other attr changes
    // biome-ignore lint/correctness/useExhaustiveDependencies: mean to be once
    useEffect(() => {
      if (!editorRef.current) return;
      const extraAttrs: Record<string, unknown> = {};
      Object.keys(rest).forEach((k) => {
        if (!(BOOL_ATTRS as readonly string[]).includes(k))
          extraAttrs[k] = (rest as Record<string, unknown>)[k];
      });
      if (Object.keys(extraAttrs).length > 0)
        editorRef.current.updateProps(extraAttrs);
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [JSON.stringify(rest)]);

    return <div ref={containerRef} />;
  },
);

JsonEditor.displayName = "JsonEditor";
