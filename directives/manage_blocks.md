# Directive: Implement Block Management (Edit & Delete)

**Status**: ✅ Completed
**Last Verified**: 2026-01-13 (Automated Browser Test)

## Goal
Enable users to edit existing block details (Label, URL) and delete blocks they no longer need.

## Context
Currently, users can only add blocks. If they make a mistake or want to remove a link, they cannot do so via the UI.

## Inputs
- `index.html`: Existing structure.
- `script.js`: Existing `config.blocks` and render logic.

## Execution Steps
1.  **UI Updates**:
    - Modify the block rendering to include a context menu or "Edit/Delete" buttons.
        - *Proposal*: Add a small context menu icon (⋮) or enable Right-Click context menu on blocks.
        - *Simpler MVP*: Add a small "x" and "✎" (edit) icon on hover of the block.
    - Reuse or adapt the `#add-modal` for editing.
        - Change title to "Modifier le bloc".
        - Pre-fill inputs.
2.  **Logic Implementation (Javascript)**:
    - `deleteBlock(blockId)`: Remove from `config.blocks`, save, render.
    - `editBlock(blockId)`: Open modal with data. On submit, update the specific block instead of creating a new one.
3.  **Refactoring**: ensure the modal handles both "Add" and "Edit" modes, or create a separate one if cleaner.

## Outputs
- Updated `script.js` with Edit/Delete functions.
- Updated `style.css` for block controls (visible on hover).
- Persistence verified.

## Edge Cases
- Editing a block that was just moved (ensure ID tracking is correct).
- Deleting the last block in a zone (should be fine).
