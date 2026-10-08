import fastf1
import pandas as pd
import numpy as np
from sklearn.model_selection import train_test_split
from sklearn.ensemble import GradientBoostingRegressor
from sklearn.metrics import mean_absolute_error
import matplotlib.pyplot as plt

#Enable F1 cache
fastf1.Cache.enable_cache('cache')

#Load the 2024 session data
session2024 = fastf1.get_session(2024, 'Australia', 'R')
session2024.load(telemetry=False, laps = True, weather = False)


#Extract relevant data
laps2024 = session2024.laps[['Driver', 'LapTime']].dropna().copy()
bestlaps2024 = laps2024.groupby('Driver')['LapTime'].min().to_frame(name='BestLapTime')
# print(bestlaps2024)
pole2024 = bestlaps2024['BestLapTime'].min()
# print(f"Pole Position Time 2024: {pole2024} done by {bestlaps2024.idxmin()}")
#Getting difference from pole
bestlaps2024['DiffFromPole'] = (bestlaps2024['BestLapTime'] - pole2024).dt.total_seconds()
bestlaps2024 = bestlaps2024.sort_values('BestLapTime', ascending=True)
# print(bestlaps2024)

#2025 Qualifying data
qualifying2025 = pd.DataFrame({
    "Driver": ["Lando Norris", "Oscar Piastri", "Max Verstappen", "George Russell", "Yuki Tsunoda",
               "Alexander Albon", "Charles Leclerc", "Lewis Hamilton", "Pierre Gasly", "Carlos Sainz", "Fernando Alonso", "Lance Stroll"],
    "QualifyingTime (s)": [75.096, 75.180, 75.481, 75.546, 75.670,
                           75.737, 75.755, 75.973, 75.980, 76.062, 76.4, 76.5]
})

driverMapping = {
    "Lando Norris": "NOR", "Oscar Piastri": "PIA", "Max Verstappen": "VER", "George Russell": "RUS",
    "Yuki Tsunoda": "TSU", "Alexander Albon": "ALB", "Charles Leclerc": "LEC", "Lewis Hamilton": "HAM",
    "Pierre Gasly": "GAS", "Carlos Sainz": "SAI", "Lance Stroll": "STR", "Fernando Alonso": "ALO"
}
qualifying2025['Driver'] = qualifying2025['Driver'].map(driverMapping)
#new dataframe has driver codes instead of full names
# print(qualifying2025)

#Merge 2024 and 2025 data
mergedData = qualifying2025.merge(bestlaps2024, on='Driver', how='inner')
print(mergedData)

#Prepare data for model
x = mergedData[['DiffFromPole']]
y = mergedData['BestLapTime'].dt.total_seconds()

#Split data into training and testing sets
x_train, x_test, y_train, y_test = train_test_split(x, y, test_size=0.2, random_state=42)


model = GradientBoostingRegressor(
    n_estimators=200,
    learning_rate=0.08,
    max_depth=3,
    random_state=42
)

model.fit(x_train, y_train)
mergedData['Predicted Race Time (s)'] = model.predict(x)
mergedData = mergedData.sort_values('Predicted Race Time (s)', ascending=True)
print(mergedData)

print("\n🏁 Predicted 2025 Australian GP Race Pace 🏁\n")
print(mergedData[["Driver", "Predicted Race Time (s)"]])

y_pred = model.predict(x_test)
mae = mean_absolute_error(y_test, y_pred)
print(f"\n🔍 Model Test MAE: {mae:.3f} seconds")