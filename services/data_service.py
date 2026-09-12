import pandas as pd

DATA_PATH = "data/weather_data.csv"


def get_weather_data():

    df = pd.read_csv(DATA_PATH)

    return df