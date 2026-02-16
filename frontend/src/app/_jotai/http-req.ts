/** biome-ignore-all lint/suspicious/noExplicitAny: jotai */
/** biome-ignore-all lint/correctness/noUnusedFunctionParameters: jotai */
import { atom } from "jotai";

export interface Header {
  id: string;
  key: string;
  value: string;
  enabled: boolean;
}

export type BodyType = "json" | "form-data" | "raw";

export interface FormDataEntry {
  id: string;
  key: string;
  value: string | File;
  type: "text" | "file";
  enabled: boolean;
}

export interface RequestData {
  method: string;
  url: string;
  headers: Header[];
  body: string;
  bodyType: BodyType;
  formDataEntries: FormDataEntry[];
  timestamp: number;
}

export const DEFAULT_REQUEST: RequestData = {
  method: "GET",
  url: "https://api.example.com/endpoint",
  headers: [
    {
      id: "1",
      key: "Content-Type",
      value: "application/json",
      enabled: true,
    },
  ],
  body: "",
  bodyType: "json",
  formDataEntries: [],
  timestamp: Date.now(),
};

// Primitive atoms
export const requestAtom = atom<RequestData>(DEFAULT_REQUEST);

// Derived atoms
export const requestMethodAtom = atom(
  (get) => get(requestAtom).method,
  (get, set, newMethod: string) => {
    set(requestAtom, {
      ...get(requestAtom),
      method: newMethod,
    });
  },
);

export const requestUrlAtom = atom(
  (get) => get(requestAtom).url,
  (get, set, newUrl: string) => {
    set(requestAtom, {
      ...get(requestAtom),
      url: newUrl,
    });
  },
);

export const requestBodyAtom = atom(
  (get) => get(requestAtom).body,
  (get, set, newBody: string) => {
    let decodedNewBody = newBody;
    try {
      decodedNewBody = atob(newBody);
    } catch (_e) {}
    set(requestAtom, {
      ...get(requestAtom),
      body: decodedNewBody,
    });
  },
);

export const requestBodyTypeAtom = atom(
  (get) => get(requestAtom).bodyType,
  (get, set, newType: BodyType) => {
    const currentReq = get(requestAtom);
    const headers = [...currentReq.headers];

    let contentTypeValue = "";
    if (newType === "json") {
      contentTypeValue = "application/json";
    } else if (newType === "form-data") {
      contentTypeValue = "multipart/form-data";
    } else if (newType === "raw") {
      contentTypeValue = "text/plain";
    }

    if (contentTypeValue) {
      const ctIndex = headers.findIndex(
        (h) => h.key.toLowerCase() === "content-type",
      );
      if (ctIndex >= 0) {
        headers[ctIndex] = {
          ...headers[ctIndex],
          value: contentTypeValue,
          enabled: true,
        };
      } else {
        headers.push({
          id: Date.now().toString(),
          key: "Content-Type",
          value: contentTypeValue,
          enabled: true,
        });
      }
    }

    set(requestAtom, {
      ...currentReq,
      bodyType: newType,
      headers: headers,
    });
  },
);

export const requestFormDataEntriesAtom = atom(
  (get) => get(requestAtom).formDataEntries,
  (get, set, newEntries: FormDataEntry[]) => {
    set(requestAtom, {
      ...get(requestAtom),
      formDataEntries: newEntries,
    });
  },
);

export const requestHeadersAtom = atom(
  (get) => get(requestAtom).headers,
  (get, set, newHeaders: Header[]) => {
    set(requestAtom, {
      ...get(requestAtom),
      headers: newHeaders,
    });
  },
);

export const requestTimestampAtom = atom(
  (get) => get(requestAtom).timestamp,
  (get, set, newTimestamp: number) => {
    set(requestAtom, {
      ...get(requestAtom),
      timestamp: newTimestamp,
    });
  },
);

export const addHeaderAtom = atom(null, (get, set) => {
  const newHeader: Header = {
    id: Date.now().toString(),
    key: "",
    value: "",
    enabled: true,
  };
  set(requestHeadersAtom, [...get(requestHeadersAtom), newHeader]);
});

export const updateHeaderAtom = atom(
  null,
  (get, set, update: { id: string; field: keyof Header; value: any }) => {
    const updatedHeaders = get(requestHeadersAtom).map((h) =>
      h.id === update.id ? { ...h, [update.field]: update.value } : h,
    );
    set(requestHeadersAtom, updatedHeaders);
  },
);

export const removeHeaderAtom = atom(null, (get, set, headerId: string) => {
  set(
    requestHeadersAtom,
    get(requestHeadersAtom).filter((h) => h.id !== headerId),
  );
});

export const addFormDataEntryAtom = atom(null, (get, set) => {
  const newEntry: FormDataEntry = {
    id: Date.now().toString(),
    key: "",
    value: "",
    type: "text",
    enabled: true,
  };
  set(requestFormDataEntriesAtom, [
    ...get(requestFormDataEntriesAtom),
    newEntry,
  ]);
});

export const updateFormDataEntryAtom = atom(
  null,
  (get, set, update: { id: string; field: keyof FormDataEntry; value: any }) => {
    const updatedEntries = get(requestFormDataEntriesAtom).map((e) =>
      e.id === update.id ? { ...e, [update.field]: update.value } : e,
    );
    set(requestFormDataEntriesAtom, updatedEntries);
  },
);

export const removeFormDataEntryAtom = atom(
  null,
  (get, set, entryId: string) => {
    set(
      requestFormDataEntriesAtom,
      get(requestFormDataEntriesAtom).filter((e) => e.id !== entryId),
    );
  },
);

export const resetRequestAtom = atom(
  null,
  (get, set, defaultRequest?: Partial<RequestData>) => {
    const resetValue = defaultRequest
      ? { ...DEFAULT_REQUEST, ...defaultRequest }
      : DEFAULT_REQUEST;

    try {
      resetValue.body = atob(resetValue.body);
    } catch (_e) {}

    if (defaultRequest?.headers) {
      resetValue.headers = defaultRequest.headers.map((h, i) => ({
        ...h,
        id: h.id || `${Date.now()}-${i}`,
      }));
    }

    if (!resetValue.formDataEntries) {
      resetValue.formDataEntries = [];
    }

    if (!resetValue.bodyType) {
      resetValue.bodyType = "json";
    }

    // Keep timestamp from defaultRequest if provided, otherwise use current time
    if (!defaultRequest?.timestamp) {
      resetValue.timestamp = Date.now();
    }

    set(requestAtom, resetValue);
  },
);
