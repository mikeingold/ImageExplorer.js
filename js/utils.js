// ========================================
//   Functions
// ========================================

/**
 * Convert an array of coordinate pairs into a single string.
 *
 * @param {Array<Array<number>>} coords - An array like `[[x1, y1], [x2, y2]]`.
 * @returns {string} A space‑separated list of "x,y" strings (e.g., `"x1,y1 x2,y2"`).
 */
function coordinate_string(coords) {
    // [ [x1, y1], [x2, y2] ] -> [ "x1,y1", "x2,y2" ] -> "x1,y1 x2,y2"
    return coords.map(c => c.join(',')).join(' ')
}

/**
 * Convert a annotation object to a compact JSON string.
 *
 * @param {Object} annotation - Annotation data with properties:
 *   `id`, `side`, `name`, `description`, and `coordinates`.
 * @returns {string} A pretty‑printed JSON string where the `coordinates`
 *   field is rendered as a single‑line array.
 */
function json_string(annotation) {
    // Generate a simplified version of the annotation with only the desired fields
    // using a placeholder for coordinates to prevent nested indentation.
    const simplified_annotation = {
        "id": annotation.id,
        "name": annotation.name,
        "description": annotation.description,
        "coordinates": "COORDINATES"
    }

    // Convert to JSON string with 4-space indents
    const s = JSON.stringify(simplified_annotation, null, 4)

    // Replace the COORDINATES placeholder with a one-liner JSON string
    const coordinate_string = JSON.stringify(annotation.coordinates).replace(/,/g, ', ')
    return s.replace(/"COORDINATES"/, coordinate_string)
}

/**
 * For a textbox with a defined placeholder, if there is currently-entered text
 * then return that. Otherwise, return the placeholder.
 */
function textbox_value_or_placeholder(el) {
    return el.value || el.placeholder;
}

function get_annotation(set, uuid) {
    // Find array index where this uuid is located in set
    const idx = set.findIndex(p => (p.uuid === uuid));
    if (idx == -1) {
        console.warn('Annotation not found');
        return;
    } else {
        return set[idx]
    }
}

// ========================================
//   Data Structures
// ========================================

class MapAnnotation {
    constructor(id, name, description, coordinates, zorder, is_user_generated=false) {
        this.uuid = globalThis.crypto.randomUUID();
        this.id = id;
        this.name = name;
        this.description = description;
        this.coordinates = coordinates;
        this.zorder = zorder;
        this.is_user_generated = is_user_generated;
    }

    static from_object(obj) {
        const zorder = (obj.zorder == null) ? 1 : Number(obj.zorder);
        return new MapAnnotation(obj.id, obj.name, obj.description, obj.coordinates, zorder);
    }
}

class MapState {
    constructor(name, image_url, annotations = []) {
        this.uuid = globalThis.crypto.randomUUID();
        this.name = name;
        this.image_url = image_url;
        this.annotations = annotations;
        this.user_annotations = [];
    }

    static from_object(obj) {
        const annotations = obj.annotations.map(MapAnnotation.from_object)
        return new MapState(obj.name, obj.image_url, annotations);
    }
}
