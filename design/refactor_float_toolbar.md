# Plan: Reusable FloatToolbar with Hover Animation

## Problem
Currently, floating toolbars in `SessionDetails` and `SavedDetails` are manually implemented with duplicated code. They are also always fully visible, which can clutter the UI.

## Proposed Solution
Create a reusable `FloatToolbar` component that hides most of its content off-screen to the right and slides in smoothly on hover.

### 1. New Component: `FloatToolbar`
- **Location**: `frontend/src/app/_components/float-toolbar.tsx`
- **Design**:
    - Absolute positioning on the right side of its relative parent.
    - Initial state: Shifted to the right (`translate-x`) so only a small "handle" or border is visible.
    - Hover state: Full width visible (`translate-x-0`).
    - Styling:
        - `bg-background/95` with `backdrop-blur`.
        - Border on top, bottom, and left (rounded-l-lg).
        - A small vertical "grabber" or dots indicator to show it's interactable.
    - Props:
        - `children`: ReactNode (the buttons/actions).
        - `top`: string (positioning, default "top-8").
        - `className`: string (extra styling).

### 2. Implementation Steps

#### Create `frontend/src/app/_components/float-toolbar.tsx`
- Implement the component with Tailwind CSS transitions for smooth animation.
- Wrap children in `TooltipProvider` to ensure tooltips work correctly even when the toolbar is partially hidden (though they should only be visible when the toolbar is expanded).

#### Update `frontend/src/app/history/_components/session-details.tsx`
- Import `FloatToolbar`.
- Replace the manual `div` and `TooltipProvider` logic with `<FloatToolbar top="top-8">`.

#### Update `frontend/src/app/saved/_components/saved-details.tsx`
- Import `FloatToolbar`.
- Replace the manual `div` and `TooltipProvider` logic with `<FloatToolbar top="top-24">`.

### 3. Verification Plan
1. Open History session details -> Verify toolbar is mostly hidden -> Hover -> Verify it slides in.
2. Open Saved session details -> Verify toolbar is mostly hidden -> Hover -> Verify it slides in.
3. Check that tooltips still work when buttons are visible.
4. Ensure the animation is smooth and doesn't flicker.
