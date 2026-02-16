"use client";

import { useSetAtom } from "jotai";
import { Hammer } from "lucide-react";
import React from "react";
import HttpReqBuilder from "./_components/http-req-builder";
import {
  HttpResponseViewer,
  HttpResponseViewerProps,
} from "./_components/http-response-viewer";
import {
  addTabAtom,
  initializeStoredTabsAtom,
} from "./_jotai/bottom-panel-store";

export function useBottomPanelTabs() {
  const addTab = useSetAtom(addTabAtom);
  const initializeStoredTabs = useSetAtom(initializeStoredTabsAtom);

  React.useEffect(() => {
    // first add the fixed tabs
    addTab({
      newTab: {
        id: "http-req-builder",
        label: "HTTP Request Builder",
        content: (
          <div className="p-4 flex flex-col h-full">
            <HttpReqBuilder />
          </div>
        ),
        icon: Hammer,
        closeable: false,
      },
      skipSync: true, // Skip sync as fixed tabs are not stored in IndexedDB
    });

    // then initialize any stored tabs from localStorage
    initializeStoredTabs((tabData) => {
      let content = null;

      // Reconstruct content based on contentType and contentProps
      if (tabData.contentType === "HttpResponseViewer") {
        content = (
          <HttpResponseViewer
            {...(tabData.contentProps as HttpResponseViewerProps)}
          />
        );
      }

      return {
        id: tabData.id,
        label: tabData.label,
        content,
        closeable: tabData.closeable,
      };
    });
  }, [addTab, initializeStoredTabs]);
}
