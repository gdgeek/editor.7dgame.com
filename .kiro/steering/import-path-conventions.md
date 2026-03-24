---
inclusion: fileMatch
fileMatchPattern: "**/*.js"
---

# Import Path Conventions: three.js/editor/js/ → plugin/

When updating import paths from `three.js/editor/js/` files to `plugin/` files, the number of `../` levels depends on the file's subdirectory depth:

| Source file location | Relative prefix to reach project root |
|---|---|
| `three.js/editor/js/*.js` | `../../../` (3 levels) |
| `three.js/editor/js/commands/*.js` | `../../../../` (4 levels) |
| `three.js/editor/js/libs/*.js` | `../../../../` (4 levels) |

From `plugin/` files back to `three.js/editor/js/`:

| Source file location | Relative prefix to reach `three.js/editor/js/` |
|---|---|
| `plugin/*.js` (root-level dirs like mrpp/, utils/, access/) | `../three.js/editor/js/` (2 levels) |
| `plugin/ui/sidebar/*.js`, `plugin/ui/menubar/*.js` | `../../../three.js/editor/js/` (3 levels) |

**Caveat**: Node.js `path.resolve` in tests may resolve paths differently than browser ES module resolution. Browser resolves relative imports based on the requesting module's URL, not the project root. Always count directory levels from the actual file location.
