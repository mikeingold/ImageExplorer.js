// ========================================
//                Maps
// ========================================

const modes = {
    upper: {
        image_url: '../maps/upper.png',
        image_width: 1123,
        image_height: 794,
        areas: [
            {
                name: 'NE555 Timer IC',
                description: 'The main 555 timer integrated circuit',
                coordinates: [[400, 250], [650, 250], [650, 550], [400, 550]],
                z_order: 1,
                details: {
                    component: 'NE555',
                    function: 'Astable Multivibrator',
                    pins: '8-pin DIP'
                }
            },
            {
                name: 'Timing Resistors',
                description: 'R1 and R2 resistors that set the frequency',
                coordinates: [[250, 150], [380, 150], [380, 350], [250, 350]],
                z_order: 2,
                details: {
                    r1: '1kΩ',
                    r2: '10kΩ',
                    function: 'Frequency control'
                }
            },
            {
                name: 'Timing Capacitor',
                description: 'Capacitor that sets the timing period',
                coordinates: [[250, 400], [380, 400], [380, 520], [250, 520]],
                z_order: 3,
                details: {
                    value: '10µF',
                    type: 'Electrolytic',
                    function: 'Timing period'
                }
            },
            {
                name: 'Output Load',
                description: 'LED and current limiting resistor',
                coordinates: [[680, 300], [850, 300], [850, 450], [680, 450]],
                z_order: 1,
                details: {
                    led: 'Red LED',
                    resistor: '330Ω',
                    current: '~15mA'
                }
            },
            {
                name: 'Power Supply',
                description: 'VCC connection and decoupling',
                coordinates: [[450, 100], [600, 100], [600, 220], [450, 220]],
                z_order: 2,
                details: {
                    voltage: '5-15V DC',
                    decoupling: '0.01µF',
                    pin: 'Pin 8 (VCC)'
                }
            }
        ]
    },
};

let current_mode = 'upper';

function get_current_config() {
    return modes[current_mode];
}

// State
function create_initial_state() {
    return {
        width: 0,
        height: 0,
        transform: d3.zoomIdentity,
        rotation: 0,
        initial_touches: null,
        initial_rotation: 0,
        initial_distance: 0,
        initial_scale: 1
    };
}

let state = create_initial_state();

// DOM elements
const container = document.getElementById('container');
const svg = d3.select('#circuit-viewer');
const tooltip = document.getElementById('tooltip');
const info_panel = document.getElementById('info-panel');

// Initialize dimensions
state.width = container.clientWidth;
state.height = container.clientHeight;
svg.attr('width', state.width).attr('height', state.height);

// Create main group
const g = svg.append('g');

// Zoom behavior (desktop only)
const zoom = d3.zoom()
    .scaleExtent([0.5, 10])
    .filter((event) => {return (event.type !== 'touchstart') && (event.type !== 'touchmove') && (event.type !== 'touchend');})
    .on('zoom', (event) => {state.transform = event.transform; apply_transform();});

svg.call(zoom);

// Image setup
g.append('image')
    .attr('href', get_current_config().image_url)
    .attr('width', get_current_config().image_width)
    .attr('height', get_current_config().image_height);

// Area rendering - sort by z_order and render in order
const sorted_areas = [...get_current_config().areas].sort(sort_by_zorder);

const area_elements = [];

function create_area_polygon(area, index) {
    const points_string = area.coordinates.map(p => p.join(',')).join(' ');

    const polygon = g.append('g')
        .attr('class', 'areas')
        .append('polygon')
        .attr('class', 'area-polygon')
        .attr('points', points_string)
        .attr('data-index', index)
        .attr('data-z-order', area.z_order ?? 0)
        .on('mouseenter', function (event) {
            // Only highlight if this is the topmost polygon at this position
            const topmost = get_topmost_polygon_at_point(event);
            if (topmost === this) {
                show_tooltip(area, event);
                d3.select(this).classed('hovered', true);
            }
        })
        .on('mousemove', function (event) {
            const topmost = get_topmost_polygon_at_point(event);
            if (topmost === this) {
                update_tooltip_position(event);
            } else {
                hide_tooltip();
                d3.select(this).classed('hovered', false);
            }
        })
        .on('mouseleave', function () {
            hide_tooltip();
            d3.select(this).classed('hovered', false);
        })
        .on('click', function (event) {
            event.stopPropagation();
            const topmost = get_topmost_polygon_at_point(event);
            if (topmost === this) {
                show_info_panel(area);
                d3.selectAll('.area-polygon').classed('selected', false);
                d3.select(this).classed('selected', true);
            }
        });

    return polygon.node();
}

// Helper function to find topmost polygon at mouse position
const get_topmost_polygon_at_point = (event) => {
    const svg_node = svg.node();
    const pt = svg_node.createSVGPoint();
    pt.x = event.clientX;
    pt.y = event.clientY;
    
    // Get all polygons under the cursor
    const elements_at_point = [];
    area_elements.forEach(el => {
        if (el.isPointInFill && el.isPointInFill(pt)) {
            elements_at_point.push(el);
        }
    });
    
    // Return the one with highest z-order
    if (elements_at_point.length === 0) return null;
    
    return elements_at_point.reduce((top, current) => {
        const top_z = parseInt(top.getAttribute('data-z-order')) || 0;
        const current_z = parseInt(current.getAttribute('data-z-order')) || 0;
        return current_z > top_z ? current : top;
    });
};

sorted_areas.forEach((area, index) => {
    area_elements.push(create_area_polygon(area, index));
});

// ========================================
//          Touchscreen Support
// ========================================

// Touch gesture handling
function get_touch_distance(touches) {
    const dx = touches[1].clientX - touches[0].clientX;
    const dy = touches[1].clientY - touches[0].clientY;
    return Math.sqrt(dx * dx + dy * dy);
}

function get_touch_angle(touches) {
    const dx = touches[1].clientX - touches[0].clientX;
    const dy = touches[1].clientY - touches[0].clientY;
    return Math.atan2(dy, dx);
}

const handle_touch_start = (event) => {
    if (event.touches.length === 2) {
        event.preventDefault();
        event.stopPropagation();
        
        state.initial_touches = Array.from(event.touches).map(t => ({
            x: t.clientX,
            y: t.clientY
        }));
        
        state.initial_rotation = state.rotation;
        state.initial_distance = get_touch_distance(event.touches);
        state.initial_scale = state.transform.k;
    }
};

const handle_touch_move = (event) => {
    if (event.touches.length === 2 && state.initial_touches) {
        event.preventDefault();
        event.stopPropagation();
        
        // Calculate rotation
        const initial_angle = Math.atan2(
            state.initial_touches[1].y - state.initial_touches[0].y,
            state.initial_touches[1].x - state.initial_touches[0].x
        );
        
        const current_angle = get_touch_angle(event.touches);
        const angle_diff = (current_angle - initial_angle) * (180 / Math.PI);
        state.rotation = state.initial_rotation + angle_diff;
        
        // Calculate zoom
        const current_distance = get_touch_distance(event.touches);
        const scale_factor = current_distance / state.initial_distance;
        const new_scale = Math.max(0.5, Math.min(10, state.initial_scale * scale_factor));
        
        // Calculate center point for zoom
        const center_x = (event.touches[0].clientX + event.touches[1].clientX) / 2;
        const center_y = (event.touches[0].clientY + event.touches[1].clientY) / 2;
        
        // Update transform
        const svg_node = svg.node();
        const rect = svg_node.getBoundingClientRect();
        const svg_x = center_x - rect.left;
        const svg_y = center_y - rect.top;
        
        // Apply scale change around touch center
        const scale_change = new_scale / state.transform.k;
        state.transform = state.transform.translate(
            (svg_x - state.transform.x) * (1 - scale_change) / state.transform.k,
            (svg_y - state.transform.y) * (1 - scale_change) / state.transform.k
        ).scale(scale_change);
        
        apply_transform();
    }
};

const handle_touch_end = (event) => {
    if (event.touches.length < 2) {
        state.initial_touches = null;
    }
};

// Attach touch listeners
const svg_node = svg.node();
svg_node.addEventListener('touchstart', handle_touch_start, { passive: false });
svg_node.addEventListener('touchmove', handle_touch_move, { passive: false });
svg_node.addEventListener('touchend', handle_touch_end, { passive: false });

// ========================================
//         Map Transformations
// ========================================

function get_rotation_center() {
    const config = get_current_config();
    return {
        x: get_current_config().image_width / 2,
        y: get_current_config().image_height / 2
    };
}

function apply_transform() {
    const center = get_rotation_center();
    g.attr('transform',
        `${state.transform} rotate(${state.rotation}, ${center.x}, ${center.y})`
    );
}

function zoom_in() {
    svg.transition().duration(300).call(zoom.scaleBy, 1.5);
}

function zoom_out() {
    svg.transition().duration(300).call(zoom.scaleBy, 0.67);
}

function rotate_left() {
    state.rotation = snap_to_45_degree_increment(state.rotation, 'left');
    g.transition().duration(300).tween('rotate', () => {
        return () => apply_transform();
    });
}

function rotate_right() {
    const start = state.rotation;
    const end = snap_to_45_degree_increment(start, 'right');
    state.rotation = end;

    g.transition()
        .duration(300)
        .attrTween("transform", () => {
            const interp = d3.interpolateNumber(start, end);
            return t => `rotate(${interp(t)})`;
        });
}

function reset_view() {
    state.rotation = 0;
    svg.transition().duration(500).call(zoom.transform, d3.zoomIdentity);
}

function fit_image_to_view() {
    const scale_x = state.width / get_current_config().image_width;
    const scale_y = state.height / get_current_config().image_height;
    const scale = 0.9 * Math.min(scale_x, scale_y);

    const x = (state.width - scale * get_current_config().image_width) / 2;
    const y = (state.height - scale * get_current_config().image_height) / 2;

    const initial_transform = d3.zoomIdentity.translate(x, y).scale(scale);
    svg.call(zoom.transform, initial_transform);
}

// ========================================
//
// ========================================

// Keyboard shortcuts
const handle_keydown = (event) => {
    // Ignore typing into input fields
    if (event.target.tagName === 'INPUT' || event.target.tagName === 'TEXTAREA') { return; }
    
    // LUT for defined actions
    const key_actions = {
        'q': rotate_left,
        'e': rotate_right,
        'r': reset_view,
        '+': zoom_in,
        '=': zoom_in,
        '-': zoom_out,
        '_': zoom_out
    };
    
    // If event.key is in key_actions LUT, perform the action
    const action = key_actions[event.key.toLowerCase()];
    if (action) { action(); }
};

// Event listeners
document.getElementById('zoom-in-btn').addEventListener('click', zoom_in);
document.getElementById('zoom-out-btn').addEventListener('click', zoom_out);
document.getElementById('rotate-left-btn').addEventListener('click', rotate_left);
document.getElementById('rotate-right-btn').addEventListener('click', rotate_right);
document.getElementById('reset-btn').addEventListener('click', reset_view);
document.addEventListener('keydown', handle_keydown);
window.addEventListener('resize', () => {
    state.width = container.clientWidth;
    state.height = container.clientHeight;
    svg.attr('width', state.width).attr('height', state.height);
});

// Initialize view
fit_image_to_view();
