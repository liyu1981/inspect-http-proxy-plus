# Design Document: Upgraded Response Body Viewer (History & Saved)

## Objective
Enhance the response body view in the `recent/history` and `saved` pages to allow switching between specialized rendered views (e.g., JSON) and a raw body view using a toggle.

## Current State
- **BodySection** (`frontend/src/app/history/_components/body-section.tsx`):
    - Automatically renders `application/json` using `JsonEditor`.
    - Fallback to raw text in a `<pre>` block.
    - No manual toggle for raw vs. rendered views.
- **Base64 Handling**:
    - `BodySection` attempts to decode Base64 for all content types.

## Proposed Changes

### 1. Enhanced `BodySection`
Modify the existing `BodySection` component to support view mode switching.
- **Location**: `frontend/src/app/history/_components/body-section.tsx`
- **Features**:
    - **View Mode State**: A boolean `isRaw` state (defaults to `false`).
    - **Toggle UI**: A `Switch` component from the UI library to toggle between "Rendered" and "Raw".
    - **Conditional Toggle**: The toggle only appears if the content type is "renderable" (initially JSON).
    - **Content Rendering**:
        - If `isRaw` is `true`: Always show the raw/decoded text in a `<pre>` block.
        - If `isRaw` is `false` and `type` is `application/json`: Show `JsonEditor`.
        - Default: Fallback to raw/decoded text.

### 2. UI/UX Enhancements
- **Switch Label**: "Raw" or "View Raw" next to the switch.
- **Placement**: Next to the size and type metadata in the section header.

## Implementation Plan

1.  **Modify `BodySection`**:
    - Add `useState` for `isRaw`.
    - Import `Switch` from `@/components/ui/switch`.
    - Implement the logic to determine if "Rendered" view is available.
    - Update the rendering logic to honor the `isRaw` state.

2.  **Verification**:
    - Test with `application/json` in both history and saved pages.
    - Test with non-JSON types (toggle should be hidden).
    - Ensure Base64 decoding still works as expected.
