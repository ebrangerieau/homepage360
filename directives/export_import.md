# Directive: Implement Layout Export/Import

**Status**: ✅ Completed
**Last Verified**: 2026-01-13 (Automated Browser Test)

## Goal
Allow users to backup their configuration (Layout + Theme) to a JSON file and restore it later.

## Context
Since data is stored in `localStorage`, clearing cache or changing browsers loses the setup. Export/Import is critical for backup and portability.

## Inputs
- `config` object in `script.js`.
- `localStorage` keys: `homepageLayout`, `theme`.

## Execution Steps
1.  **UI Updates**:
    - Add "Export" (⬇️) and "Import" (⬆️) buttons to the header controls.
    - Add a hidden file input for import.
2.  **Logic Implementation (Javascript)**:
    - `exportConfig()`:
        - Gather `config` and `theme` from localStorage/memory.
        - Create a Blob (`application/json`) and trigger a download: `homepage360-backup-[DATE].json`.
    - `importConfig(file)`:
        - Read file via `FileReader`.
        - Validate JSON structure (zones array, blocks array).
        - Update `config`, save to `localStorage`, apply theme, and `render()`.
3.  **Validation**:
    - Ensure importing a malformed file doesn't break the app (alert error).

## Outputs
- Updated `index.html` with buttons.
- Updated `script.js` with Export/Import logic.

## Edge Cases
- Importing an old config version (not an issue yet).
- JSON syntax error in file.
