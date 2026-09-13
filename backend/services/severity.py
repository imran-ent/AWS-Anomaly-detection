def get_severity(score):

    if score > 0.8:
        return "HIGH"

    elif score > 0.5:
        return "MEDIUM"

    return "LOW"