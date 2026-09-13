"""
Station metadata for synthetic fields not in raw dataset (rainfall, wind, lat/lon, elevation).
Dataset only has City, temperature, humidity, pressure per hour.
Frontend expects richer station objects; we synthesize deterministic plausible values.
"""
# Approx coords and elevation for each city present in dataset
CITY_META = {
    "Agartala": {"state": "Tripura", "lat": 23.8315, "lon": 91.2868, "elevation": 12},
    "Ahmedabad": {"state": "Gujarat", "lat": 23.0225, "lon": 72.5714, "elevation": 53},
    "Aizawl": {"state": "Mizoram", "lat": 23.7307, "lon": 92.7173, "elevation": 1132},
    "Bengaluru": {"state": "Karnataka", "lat": 12.9716, "lon": 77.5946, "elevation": 920},
    "Bhopal": {"state": "Madhya Pradesh", "lat": 23.2599, "lon": 77.4126, "elevation": 527},
    "Bhubaneswar": {"state": "Odisha", "lat": 20.2961, "lon": 85.8245, "elevation": 45},
    "Chandigarh": {"state": "Chandigarh", "lat": 30.7333, "lon": 76.7794, "elevation": 321},
    "Chennai": {"state": "Tamil Nadu", "lat": 13.0827, "lon": 80.2707, "elevation": 6},
    "Dehradun": {"state": "Uttarakhand", "lat": 30.3165, "lon": 78.0322, "elevation": 640},
    "Delhi": {"state": "Delhi", "lat": 28.7041, "lon": 77.1025, "elevation": 216},
    "Gangtok": {"state": "Sikkim", "lat": 27.3389, "lon": 88.6065, "elevation": 1650},
    "Gurugram": {"state": "Haryana", "lat": 28.4595, "lon": 77.0266, "elevation": 217},
    "Guwahati": {"state": "Assam", "lat": 26.1445, "lon": 91.7362, "elevation": 55},
    "Hyderabad": {"state": "Telangana", "lat": 17.3850, "lon": 78.4867, "elevation": 542},
    "Imphal": {"state": "Manipur", "lat": 24.8170, "lon": 93.9368, "elevation": 786},
    "Itanagar": {"state": "Arunachal Pradesh", "lat": 27.0844, "lon": 93.6053, "elevation": 320},
    "Jaipur": {"state": "Rajasthan", "lat": 26.9124, "lon": 75.7873, "elevation": 431},
    "Kohima": {"state": "Nagaland", "lat": 25.6751, "lon": 94.1086, "elevation": 1444},
    "Kolkata": {"state": "West Bengal", "lat": 22.5726, "lon": 88.3639, "elevation": 9},
    "Lucknow": {"state": "Uttar Pradesh", "lat": 26.8467, "lon": 80.9462, "elevation": 123},
    "Mumbai": {"state": "Maharashtra", "lat": 19.0760, "lon": 72.8777, "elevation": 14},
    "Panaji": {"state": "Goa", "lat": 15.4909, "lon": 73.8278, "elevation": 7},
    "Patna": {"state": "Bihar", "lat": 25.5941, "lon": 85.1376, "elevation": 58},
    "Raipur": {"state": "Chhattisgarh", "lat": 21.2514, "lon": 81.6296, "elevation": 298},
    "Ranchi": {"state": "Jharkhand", "lat": 23.3441, "lon": 85.3096, "elevation": 651},
    "Shillong": {"state": "Meghalaya", "lat": 25.5788, "lon": 91.8933, "elevation": 1525},
    "Shimla": {"state": "Himachal Pradesh", "lat": 31.1048, "lon": 77.1734, "elevation": 2206},
    "Thiruvananthapuram": {"state": "Kerala", "lat": 8.5241, "lon": 76.9366, "elevation": 64},
    "Visakhapatnam": {"state": "Andhra Pradesh", "lat": 17.6868, "lon": 83.2185, "elevation": 45},
}

# Map station_id -> city via dataset; fallback to CITY_META keys order if unknown
STATION_ID_TO_CITY = {
    f"AWS{str(i).zfill(3)}": city
    for i, city in enumerate(sorted(CITY_META.keys()), start=1)
}
# But sorted order differs from dataset order; dataset order is deterministic:
# AWS001 Agartala, AWS002 Ahmedabad, etc as per file appearance. So build from dataset order:
ORDERED_CITIES = [
    "Agartala","Ahmedabad","Aizawl","Bengaluru","Bhopal","Bhubaneswar","Chandigarh","Chennai","Dehradun","Delhi",
    "Gangtok","Gurugram","Guwahati","Hyderabad","Imphal","Itanagar","Jaipur","Kohima","Kolkata","Lucknow",
    "Mumbai","Panaji","Patna","Raipur","Ranchi","Shillong","Shimla","Thiruvananthapuram","Visakhapatnam"
]
STATION_ID_TO_CITY = {f"AWS{str(i).zfill(3)}": city for i, city in enumerate(ORDERED_CITIES, start=1)}

def get_station_meta(station_id, city=None):
    c = city or STATION_ID_TO_CITY.get(station_id, "Delhi")
    meta = CITY_META.get(c, CITY_META["Delhi"])
    return {
        "location": c,
        "city": c,
        "state": meta["state"],
        "latitude": meta["lat"],
        "longitude": meta["lon"],
        "elevation": meta["elevation"],
    }

def synth_rainfall(row):
    """Deterministic synthetic rainfall derived from humidity & pressure."""
    # humidity >85 => chances of rain; pressure <1000 => heavier
    h = float(row.get("humidity", 50) or 50)
    p = float(row.get("pressure", 1010) or 1010)
    # base: humidity driven
    base = max(0, (h - 75) * 0.8)
    # pressure dip boosts
    if p < 1002:
        base += (1002 - p) * 1.2
    # add small deterministic jitter using timestamp hour
    try:
        hour = pd_to_hour(row.get("timestamp"))
    except:
        hour = 0
    jitter = (hash(str(row.get("station_id", ""))+str(hour)) % 100) / 50.0
    val = base + jitter
    return round(max(0, val), 1)

def synth_wind(row):
    h = float(row.get("humidity", 50) or 50)
    p = float(row.get("pressure", 1010) or 1010)
    t = float(row.get("temperature", 30) or 30)
    # pressure gradient drives wind
    base = 8 + abs(1010 - p) * 0.6 + abs(t - 30) * 0.2
    # clamp
    return round(max(3, min(70, base)), 1)

def synth_wind_dir(station_id):
    dirs = ["N","NE","E","SE","S","SW","W","NW"]
    idx = hash(station_id) % len(dirs)
    return dirs[idx]

def pd_to_hour(ts):
    import pandas as pd
    try:
        return pd.to_datetime(ts).hour
    except:
        return 0
