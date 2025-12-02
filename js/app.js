// ========================================
//   STATE
// ========================================

// Default Upper and Lower Views
let MAP_UPPER = MapState.from_object(LOAD_MAP_UPPER);
let MAP_LOWER = MapState.from_object(LOAD_MAP_LOWER);

// Application state
let current_map_state = MAP_UPPER;
let dev_tools_enabled = false; // Whether developer mode is active
let tracing = false;                // whether user is currently tracing a annotation

// User-generated annotations
let current_tracing_points = [];    // array of [x, y] coordinates for annotation being traced
let target_annotation = null;          // the currently-selected user-generated annotation

// D3 references - will be initialized after DOM loads
let container, svg, g, zoom, tooltip, info;


// ========================================
//   MODAL: ICON SPLASH
// ========================================

function hide_splash_modal() {
    document.getElementById('app-splash-modal').classList.remove("visible");
}


// ========================================
//   BASIC MAP FUNCTIONS
// ========================================

/**
 * Loads an image and sets up the initial view
 * Calculates appropriate zoom level to fit image in viewport
 */
function load_image(map_state) {
    // Clear any existing content (image and annotations)
    g.selectAll('*').remove();

    // Use native Image object to get dimensions before rendering
    const img = new Image();
    img.onload = function() {
        // Determine heights & widths of window and image
        const image_height = this.height;
        const image_width = this.width;
        const window_height = window.innerHeight;
        const window_width = window.innerWidth;
        const ratio_height = window_height / image_height
        const ratio_width = window_width / image_width
        // Fit image in viewport, leaving some margin around the edges
        const scale = 0.9 * Math.min(ratio_width, ratio_height);
        // Center the image in the viewport
        const offsetX = (window_width - image_width * scale) / 2;
        const offsetY = (window_height - image_height * scale) / 2;

        // Add image element to SVG at native resolution
        g.append('image')
            .attr('href', map_state.image_url)
            .attr('width', image_width)
            .attr('height', image_height);
        // Apply initial transform to center and scale the image
        svg.call(zoom.transform, d3.zoomIdentity
            .translate(offsetX, offsetY)
            .scale(scale)
        );
        // Render annotation overlays on top of image after a short delay
        // This ensures the transform is applied before rendering annotations
        setTimeout(() => { render_annotations() }, 10);
    };
    img.onerror = function() {
        console.error('Failed to load image:', map_state.image_url);
    };
    img.src = map_state.image_url;
}

/**
 * Renders all annotation features on the map
 * Includes both sample features and user-generated annotations
 * Attaches hover events for tooltip display
 */
function render_annotations() {
    // Remove any existing annotations to avoid duplicates
    g.selectAll('.annotation-area').remove();

    // Event handlers to be assigned later in this function
    const g_mouseenter = (event, d) => {
        if (tracing) return; // no tooltips while tracing
        d3.select('#tooltip-title').text(d.name);
        d3.select('#tooltip-description').text(d.description);
        tooltip.classed('visible', true);
    };
    const g_mousemove = (event) => {
        if (tracing) return; // no tooltips while tracing
        position_x = String(event.pageX + 15) + 'px'
        position_y = String(event.pageY + 15) + 'px'
        tooltip
            .style('left', position_x)
            .style('top', position_y);
    };
    const g_mouseleave = () => {
        // Hide tooltip when mouse leaves annotation
        tooltip.classed('visible', false);
    }
    const g_click = (event, d) => {
        event.stopPropagation(); // stop event from propagating to map features behind this one
        if (tracing) return; // no tooltips while tracing
        if (d.is_user_generated) {
            open_user_annotation_info_panel(get_annotation(current_map_state.user_annotations, d.uuid))
        } else {
            open_annotation_info_panel(get_annotation(current_map_state.annotations, d.uuid))
        }
    }

    // Mark user-generated annotations with a flag for styling
    const allFeatures = [
        ...current_map_state.annotations,
        ...current_map_state.user_annotations
    ];

    // Draw SVG annotations from annotations data using D3 data binding
    g.selectAll('.annotation-area')
        .data(allFeatures)
        .enter()
        .append('polygon')
        .attr('class', d => d.is_user_generated ? 'annotation-area user-generated' : 'annotation-area') // css class
        .attr('points', d => coordinate_string(d.coordinates))
        .on('mouseenter', g_mouseenter)
        .on('mousemove', g_mousemove)
        .on('mouseleave', g_mouseleave)
        .on('click', g_click);
}

function handle_window_resize() {
    svg.attr('width', window.innerWidth)
        .attr('height', window.innerHeight);
}

function zoom_in() {
    svg.transition()
        .duration(300)
        .call(zoom.scaleBy, 5/4);
}

function zoom_out() {
    svg.transition()
        .duration(300)
        .call(zoom.scaleBy, 4/5);
}

// ========================================
//   RESET MAP
// ========================================

/**
 * Closes the reset confirmation modal
 */
function open_reset_confirmation_modal() {
    document.getElementById('reset-modal').classList.add('visible');
}

/**
 * Closes the reset confirmation modal
 */
function close_reset_confirmation_modal() {
    document.getElementById('reset-modal').classList.remove('visible');
}

/**
 * Resets zoom/pan to original fitted view
 * If user-generated annotations exist, shows confirmation modal first
 */
function request_reset_view() {
    if (current_map_state.user_annotations.length == 0) {
        // No user annotations, skip ahead to reset
        perform_reset_view();
    } else {
        // Trigger pop-up requiring confirmation to proceed
        open_reset_confirmation_modal();
        // User must select Reset or Cancel, which will trigger actions separately
    }
}

/**
 * Performs the actual reset operation: clears user annotations and reloads the image
 */
function perform_reset_view() {
    current_map_state.user_annotations = [];
    close_reset_confirmation_modal();
    load_image(current_map_state);
}

function handle_click_normal() {
    close_annotation_info_panel();
    close_user_annotation_info_panel();
}

// ========================================
//   UPPER/LOWER VIEWS
// ========================================

function switch_to_lower_view() {
    // Set button states
    document.getElementById('upper-view-btn').classList.remove('active');
    document.getElementById('lower-view-btn').classList.add('active');

    // Close annotation info panels if needed
    close_annotation_info_panel();
    close_user_annotation_info_panel();

    current_map_state = MAP_LOWER;
    load_image(current_map_state);
}

function switch_to_upper_view() {
    // Set button states
    document.getElementById('upper-view-btn').classList.add('active');
    document.getElementById('lower-view-btn').classList.remove('active');

    // Close annotation info panels if needed
    close_annotation_info_panel();
    close_user_annotation_info_panel();
    
    current_map_state = MAP_UPPER;
    load_image(current_map_state);
}

// ========================================
//   DEVELOPER TOOLS
// ========================================

/**
 * Toggles developer mode on/off
 * Shows/hides dev controls panel and updates toggle button appearance
 */
function toggle_dev_tools() {
    dev_tools_enabled = !dev_tools_enabled;
    const toggle_button = document.getElementById('dev-mode-toggle');
    const dev_controls = document.getElementById('dev-controls');
    
    if (dev_tools_enabled) {
        // Enable  mode - show controls panel and change button color
        toggle_button.classList.add('active');
        dev_controls.classList.add('visible');
    } else {
        // Disable dev mode - hide controls and clean up
        toggle_button.classList.remove('active');
        dev_controls.classList.remove('visible');
        exit_tracing(); // Clean up if tracing was in progress
    }
}

// ========================================
//   ANNOTATION TRACING
// ========================================

/**
 * Handles keyboard shortcuts during tracing mode
 * Enter: Complete annotation and open metadata modal
 * Escape: Cancel tracing and discard current annotation
 * @param {KeyboardEvent} event - The keyboard event
 */
function handle_keypress_while_tracing(event) {
    if (event.key === 'Enter' && tracing) {
        complete_annotation();
    } else if (event.key === 'Escape' && tracing) {
        exit_tracing();
    }
}

/**
 * Handles clicks during tracing to add annotation vertices
 * Updates visual feedback by drawing points and connecting lines
 * @param {MouseEvent} event - The click event
 */
function handle_click_while_tracing(event) {
    if (!tracing) return;
    
    // Get click coordinates (in the mapped space), save them to traced annotation
    const [x, y] = d3.pointer(event, g.node());
    current_tracing_points.push([Math.round(x), Math.round(y)]); // avoid sub-pixel issues
    
    // Draw a circle at the clicked point to mark the vertex
    g.append('circle')
        .attr('class', 'drawing-point')
        .attr('cx', x)
        .attr('cy', y)
        .attr('r', 5);
    
    // After 2+ points, show the annotation shape preview
    if (current_tracing_points.length > 1) {
        // Remove old annotation preview and redraw with new point
        g.selectAll('.drawing-annotation').remove();
        g.append('polygon')
            .attr('class', 'drawing-annotation')
            .attr('points', coordinate_string(current_tracing_points));
    }
}

/**
 * Begins annotation tracing mode
 * Changes cursor to crosshair and enables click handler for vertex placement
 */
function begin_tracing() {
    tracing = true;
    current_tracing_points = [];

    // Close any open info panels
    close_annotation_info_panel();
    close_user_annotation_info_panel();
    
    // Change cursor to crosshairs
    document.getElementById('container').classList.add('tracing');
    document.querySelectorAll('.annotation-area').forEach(p => p.classList.add("tracing"))
    // Temporarily disable/gray the "Trace a Feature" button
    document.getElementById('trace-btn').disabled = true;
    // Make the tracing action buttons visible
    document.getElementById('tracing-controls').classList.add("active")
    
    // Clear any previous drawing artifacts from abandoned tracings
    g.selectAll('.drawing-annotation, .drawing-point').remove();
    
    // Enable click handling for placing vertices
    svg.on('click', handle_click_while_tracing);
    // Enable keyboard shortcuts for finishing/canceling
    document.addEventListener('keydown', handle_keypress_while_tracing);
    // Hide any visible tooltips to avoid confusion
    tooltip.classed('visible', false);
}

/**
 * Completes the current annotation and shows annotation info panel
 */
function complete_annotation() {
    // Polygons need at least 3 vertices to be valid
    if (current_tracing_points.length < 3) {
        alert('Please trace at least 3 points to create a polygon');
        return;
    }
    
    // Generate new annotation
    const id = "new-id";
    const name = "New Feature Name";
    const description = "New feature description";
    const coordinates = current_tracing_points;
    const zorder = 1;
    const is_user_generated = true;
    const new_annotation = new MapAnnotation(id, name, description, coordinates, zorder, is_user_generated)
    
    // Add it to the current user_annotation array and target it
    current_map_state.user_annotations.push(new_annotation);
    target_annotation = new_annotation;

    // Update UI: exit tracing, open annotation info panel, re-render all annotations
    exit_tracing()
    open_user_annotation_info_panel(new_annotation);
    render_annotations()
}

/**
 * Exits tracing mode and cleans up visual artifacts
 */
function exit_tracing() {
    tracing = false;
    current_tracing_points = [];

    // Revert handlers
    svg.on('click', handle_click_normal);
    document.removeEventListener('keydown', handle_keypress_while_tracing);
    
    // Restore normal grab cursor
    document.getElementById('container').classList.remove('tracing');
    document.querySelectorAll('.annotation-area').forEach(p => p.classList.remove("tracing"))
    
    // Remove any drawing artifacts (points and annotation preview)
    g.selectAll('.drawing-annotation, .drawing-point').remove();
    
    // Reset button visibility to initial dev mode state
    document.getElementById('trace-btn').disabled = false;
    document.getElementById('tracing-controls').classList.remove("active")
}

// ========================================
//   ANNOTATION INFO PANEL (STANDARD)
// ========================================

function open_annotation_info_panel(annotation) {
    // Make only the correct panel visible
    document.getElementById('annotation-std-info-panel').classList.add('visible');
    close_user_annotation_info_panel()

    // Set text fields
    document.getElementById('annotation-id').value = annotation.id;
    document.getElementById('annotation-name').value = annotation.name;
    document.getElementById('annotation-description').value = annotation.description;
}

function close_annotation_info_panel() {
    // Make panel invisible
    document.getElementById('annotation-std-info-panel').classList.remove('visible');

    // Blank the text fields
    document.getElementById('annotation-id').value = '';
    document.getElementById('annotation-name').value = '';
    document.getElementById('annotation-description').value = '';
}

// ========================================
//   ANNOTATION INFO PANEL (USER-GENERATED)
// ========================================

function open_user_annotation_info_panel(annotation) {
    // Make only the correct panel visible
    close_annotation_info_panel()
    document.getElementById('annotation-user-info-panel').classList.add('visible');

    // Set text fields
    document.getElementById('user-annotation-id').value = annotation.id;
    document.getElementById('user-annotation-name').value = annotation.name;
    document.getElementById('user-annotation-description').value = annotation.description;

    // Initialize JSON textbox contents
    update_user_annotation_info()
}

function close_user_annotation_info_panel() {
    // Make panel invisible
    document.getElementById('annotation-user-info-panel').classList.remove('visible');

    // Blank the text fields
    document.getElementById('user-annotation-id').value = '';
    document.getElementById('user-annotation-name').value = '';
    document.getElementById('user-annotation-description').value = '';
    document.getElementById('user-annotation-json').value = '';
}

/**
 * Uses User Annotation Info Panel information to update target_annotation and JSON textarea
 */
function update_user_annotation_info() {
    // Update targeted annotation
    target_annotation.id = textbox_value_or_placeholder(document.getElementById('user-annotation-id'));
    target_annotation.name = textbox_value_or_placeholder(document.getElementById('user-annotation-name'));
    target_annotation.description = textbox_value_or_placeholder(document.getElementById('user-annotation-description'));

    // Convert data to JSON string and write it into the textbox
    document.getElementById('user-annotation-json').value = json_string(target_annotation);
}

/**
 * Remove one annotation from the current map state.
 *
 * @param {Object} annotation - The annotation object to remove.
 */
function discard_user_annotation(annotation) {
    // Find index of this annotation in the currently-pointed-to user_annotations array
    const idx = current_map_state.user_annotations.findIndex(p => (p.uuid === annotation.uuid));
    if (idx == -1) {
        // Not found - generate warning
        console.warn(`Annotation with UUID ${annotation.uuid} not found in user_annotations`);
    } else {
        // Found - remove it
        current_map_state.user_annotations.splice(idx, 1);
    }
}

function discard_action() {
    discard_user_annotation(target_annotation)
    close_user_annotation_info_panel()
    render_annotations()
}

/**
 * Acknowledge successful clipboard action by briefly replacing the copy icon with a checkmark icon.
 */
function animate_json_clipboard_success() {
    // Acknowledge action by changing icon from copy symbol to checkmark
    const img = document.getElementById('img-copy-icon');
    img.src = "assets/icons/icon_check.svg";

    // Schedule change back to copy symbol after a slight delay
    const delay_ms = 800;
    setTimeout(() => { img.src = "assets/icons/icon_copy.svg"; }, delay_ms);
}

/**
 * Copies annotation JSON output to the user's clipboard. Shows animated visual when
 * successful, or prints a console error on failure.
 */
async function copy_json_to_clipboard() {
    // Select all text in the "JSON Output" textbox and copy to clipboard
    const json_textbox = document.getElementById('user-annotation-json');
    
    // Use Clipboard API to attempt copy-to-clipboard
    try {
        await navigator.clipboard.writeText(json_textbox.value)
        animate_json_clipboard_success()
    } catch (err) {
        console.error("Copying to user clipboard failed: ", err)
    }
}

// ========================================
//   DEV TOOLS: IMAGE UPLOAD
// ========================================

/**
 * Handles custom image upload from file input
 * Clears all annotations (features and user-generated) since coordinates are image-specific
 */
function handle_user_image_upload(e) {
    const file = e.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = function(event) {
            // Mark Upper/Lower view buttons as inactive
            document.getElementById('upper-view-btn').classList.remove('active');
            document.getElementById('lower-view-btn').classList.remove('active');

            // Generate new MapState with this uploaded image
            current_map_state = new MapState("user", event.target.result)
            load_image(current_map_state);
        };
        // Convert file to data URL
        reader.readAsDataURL(file);
    }
}

/**
 * Triggers the hidden file input when the styled button is clicked
 */
function trigger_image_upload() {
    document.getElementById('image-upload').click();
}

// ========================================
//             INITIALIZATION
// ========================================

/**
 * Initializes the application after DOM is fully loaded
 * Sets up all event listeners and loads the initial image
 */
function initialize() {
    // Initialize D3 references
    container = d3.select('#container');
    svg = d3.select('#map-viewer'); // the SVG block inside the div#container
    g = svg.append('g');  // group element inside SVG
    zoom = d3.zoom();

    // Set initial SVG size to initial window size
    svg.attr('width', window.innerWidth).attr('height', window.innerHeight);

    // Configure zoom behavior
    zoom.scaleExtent([0.5, 10]) // Min-max zoom levels
        .on('start', () => container.classed('grabbing', true))
        .on('zoom', (event) => g.attr('transform', event.transform))  // Apply transform to SVG group while panning
        .on('end',   () => container.classed('grabbing', false))

    // Apply zoom behavior to SVG element
    svg.call(zoom);

    // Close Info Panel when bare map is clicked
    svg.on('click', handle_click_normal);

    // Reference to tooltip element for showing annotation metadata
    tooltip = d3.select('#tooltip');

    // Attach event listeners to interactive elements
    //   Always displayed
    document.getElementById('dev-mode-toggle').addEventListener('click', toggle_dev_tools);
    document.getElementById('reset-btn').addEventListener('click', request_reset_view);
    document.getElementById('zoom-in-btn').addEventListener('click', zoom_in);
    document.getElementById('zoom-out-btn').addEventListener('click', zoom_out);
    document.getElementById('upper-view-btn').addEventListener('click', switch_to_upper_view);
    document.getElementById('lower-view-btn').addEventListener('click', switch_to_lower_view);
    //   Developer Tools
    document.getElementById('load-image-btn').addEventListener('click', trigger_image_upload);
    document.getElementById('trace-btn').addEventListener('click', begin_tracing);
    document.getElementById('finish-tracing-btn').addEventListener('click', complete_annotation);
    document.getElementById('cancel-tracing-btn').addEventListener('click', exit_tracing);
    //   Panel: Annotation Info (User-Generated)
    document.getElementById('json-copy-icon').addEventListener('click', copy_json_to_clipboard);
    document.getElementById('user-annotation-id').addEventListener('input', update_user_annotation_info);
    document.getElementById('user-annotation-name').addEventListener('input', update_user_annotation_info);
    document.getElementById('user-annotation-description').addEventListener('input', update_user_annotation_info);
    document.getElementById('discard-annotation-btn').addEventListener('click', discard_action);
    //   Modal: Splash
    document.getElementById('app-splash-modal').addEventListener('click', hide_splash_modal);
    
    //   Modal: Confirm Reset
    document.getElementById('confirm-reset-btn').addEventListener('click', perform_reset_view);
    document.getElementById('cancel-reset-btn').addEventListener('click', close_reset_confirmation_modal);
    //   Background workers
    document.getElementById('image-upload').addEventListener('change', handle_user_image_upload);
    //   Window resizes - keep SVG full-window
    window.addEventListener('resize', handle_window_resize);

    // Load sample image and features on initialization
    load_image(current_map_state);
}

// Wait for DOM to be fully loaded before initializing
// This ensures all elements are available when we try to access them
document.addEventListener('DOMContentLoaded', initialize);
