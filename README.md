# ImageExplorer.js

ImageExplorer.js is a simple webapp-engine for exploring annotated image files in a browser from a statically-hosted site.

## Map Loading Instructions

Map datasets are defined via:
- A JavaScript file `maps/$NAME.js` containing the map information.
- An image file in the maps directory to be used as the map graphic.

The bottom of `index.html` includes a section `<!-- Maps -->`. This section should include one `<script>` link per utilized map file.

The `maps/$NAME.js` file should define an object `LOAD_MAP_$NAME` with the following fields:
- `name` (string)
- `description` (string)
- `image_url` (string), URL for map image, relative to project root, e.g. `maps/$NAME.jpg`.
- `annotations` (array of annotation objects)

The file `maps/_index.html` contains an array `MAPS` that should include the `LOAD_MAP_$NAME` name.
