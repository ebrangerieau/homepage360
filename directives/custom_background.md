# Directive: Implement Custom Background

**Status**: ✅ Completed
**Last Verified**: 2026-01-13 (Automated Browser Test)

## Goal
Allow users to personalize the homepage by setting a custom background image or color URL.

## Context
Currently, the background is a simple solid color defined in CSS variables. Users want to make the page their own with wallpapers.

## Inputs
- `style.css`: Uses `--color-bg` variables.
- `script.js`: Configuration object.

## Execution Steps
1.  **UI Updates**:
    - Add a "Background" button (🖼️) to the header.
    - Create a modal allowing users to enter an Image URL.
    - Option to reset to default theme.
2.  **Logic Implementation (Javascript)**:
    - `setBackground(url)`:
        - Validate URL (basic check).
        - Update `config.background`.
        - Apply to `body.style.backgroundImage`.
        - Save to `localStorage`.
    - `clearBackground()`: Remove inline style, revert to CSS variables.
3.  **Styling**:
    - Ensure text readability on images (maybe add an overlay/backdrop filter).

## Outputs
- Updated `index.html`, `style.css`, `script.js`.

## Edge Cases
- Invalid image URL (show error or fallback).
- Image too bright (text unreadable) -> User responsibility, but we can add a dimming slider later.
