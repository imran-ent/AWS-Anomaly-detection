def classify_fault(
    current_value,
    previous_value,
    recent_values
):

    # Spike
    if abs(
        current_value - previous_value
    ) > 10:

        return "SPIKE"

    # Frozen
    if len(
        set(recent_values)
    ) == 1:

        return "FROZEN_SENSOR"

    return "UNKNOWN"