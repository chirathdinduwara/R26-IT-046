def get_crop_stage(crop_week: int):
    if crop_week <= 2:
        return "Establishment"
    elif crop_week <= 5:
        return "Tillering"
    elif crop_week <= 9:
        return "Panicle Initiation"
    elif crop_week <= 13:
        return "Grain Filling"
    return "Maturity"


def get_crop_calendar_rules(crop_week, season, pH, total_rainfall):
    stage = get_crop_stage(crop_week)
    rules = []

    if stage == "Establishment":
        rules.append("Maintain shallow water level and monitor seedling establishment.")
    elif stage == "Tillering":
        rules.append("Tillering stage detected. Monitor nitrogen requirement and weed control.")
    elif stage == "Panicle Initiation":
        rules.append("Panicle initiation stage detected. Avoid water stress during this period.")
    elif stage == "Grain Filling":
        rules.append("Grain filling stage detected. Maintain adequate water and monitor pest symptoms.")
    else:
        rules.append("Maturity stage detected. Prepare for harvesting and avoid unnecessary fertilizer.")

    if pH < 5.5:
        rules.append("Soil pH is acidic. Consider lime application based on expert recommendation.")

    if total_rainfall > 80:
        rules.append("High rainfall is expected in the next 7 days. Delay fertilizer application and improve drainage.")
    elif total_rainfall < 20:
        rules.append("Low rainfall is expected in the next 7 days. Plan irrigation carefully.")

    if season == "Yala":
        rules.append("Yala season usually needs careful irrigation planning.")
    else:
        rules.append("Maha season requires close rainfall monitoring.")

    return stage, rules