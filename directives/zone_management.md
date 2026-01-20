# Directive: Implement Zone Management

**Status**: ✅ Completed
**Last Verified**: 2026-01-13 (Automated Browser Test)

## Goal
Allow users to dynamically add and remove zones (categories) in the Homepage 360 application via the UI.

## Context
Currently, zones ("Outils", "Microsoft", "IA") are hardcoded in the configuration. The user needs to be able to manage these via the interface, similar to how blocks are managed.

## Inputs
- Existing `script.js` with `config.zones`.
- `index.html` structure.

## Execution Steps
1.  **Update Configuration Data Structure**: Ensure `config.zones` can be modified.
2.  **UI Updates**:
    - Add a "Manage Zones" button or specific "+ Zone" button.
    - Create a modal or inline input to specify the new Zone Title.
    - Add a "Delete" button to each existing zone (prevent deletion if not empty, or ask for confirmation).
3.  **Logic Implementation (Javascript)**:
    - Function `addZone(title)`: pushes to `config.zones`, saves to localStorage, re-renders.
    - Function `removeZone(zoneId)`: removes from `config.zones`, handles orphaned blocks (delete or move to default?), saves, re-renders.
4.  **Persistence**: Ensure changes allow survivability across reloads (already handled if `config` is saved).

## Outputs
- Updated `index.html` with Zone controls.
- Updated `script.js` with `addZone` / `deleteZone` logic.
- Updated `style.css` for new UI elements.

## Edge Cases
- Deleting a zone that contains blocks:
  - *Decision*: Prevent deletion OR Move blocks to a "Uncategorized" zone.
  - *Choice*: Prevent deletion for now to be safe. "Zone must be empty to delete".
- Duplicate zone names.
