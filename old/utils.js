function sort_by_zorder(a, b) {
    const z_a = a.z_order ?? 0;
    const z_b = b.z_order ?? 0;
    return z_a - z_b;
}

function next_left_rotation(angle) {
    const normalized = ((angle % 360) + 360) % 360;
    const current_increment = normalized / 45;
    let next_increment = Math.floor(current_increment);
    if (next_increment === current_increment) { next_increment -= 1; }
    return next_increment * 45;
}

function next_right_rotation(angle) {
    const normalized = ((angle % 360) + 360) % 360;
    const current_increment = normalized / 45;
    let next_increment = Math.ceil(current_increment);
    if (next_increment === current_increment) { next_increment += 1; }
    return next_increment * 45;
}

function snap_to_45_degree_increment(current_rotation, direction) {
    if (direction === 'left') {
        return next_left_rotation(current_rotation);
    } else if (direction === 'right') {
        return next_right_rotation(current_rotation);
    } else {
        console.error(`Unrecognized direction: ${direction}`)
    }
}
