import fastf1
import pandas as pd
import numpy as np
from sklearn.model_selection import train_test_split
from sklearn.ensemble import GradientBoostingRegressor
from sklearn.metrics import mean_absolute_error


fastf1.Cache.enable_cache('cache')
session2024 = fastf1.get_session(2024, 'China', 'R')
session2024.load()

#Extract lap and sector times
laps2024 = session2024.laps[['Driver', 'LapTime', 'Sector1Time', 'Sector2Time', 'Sector3Time']].copy()
laps2024.dropna(inplace=True)

print(laps2024)

#Convert lap times to total seconds for easier calculations
for col in ['LapTime', 'Sector1Time', 'Sector2Time', 'Sector3Time']:
    laps2024[col] = laps2024[col].dt.total_seconds()

print(laps2024)

#get mean sector times per driver
meanSectors2024 = laps2024.groupby('Driver')[['Sector1Time', 'Sector2Time', 'Sector3Time']].mean().reset_index()
print(meanSectors2024)

#2025 Qualifying data
qualifying_2025 = pd.DataFrame({
    "Driver": ["Oscar Piastri", "George Russell", "Lando Norris", "Max Verstappen", "Lewis Hamilton",
               "Charles Leclerc", "Isack Hadjar", "Andrea Kimi Antonelli", "Yuki Tsunoda", "Alexander Albon",
               "Esteban Ocon", "Nico Hülkenberg", "Fernando Alonso", "Lance Stroll", "Carlos Sainz Jr.",
               "Pierre Gasly", "Oliver Bearman", "Jack Doohan", "Gabriel Bortoleto", "Liam Lawson"],
    "QualifyingTime (s)": [90.641, 90.723, 90.793, 90.817, 90.927,
                           91.021, 91.079, 91.103, 91.638, 91.706,
                           91.625, 91.632, 91.688, 91.773, 91.840,
                           91.992, 92.018, 92.092, 92.141, 92.174]
})

driver_mapping = {
    "Oscar Piastri": "PIA", "George Russell": "RUS", "Lando Norris": "NOR", "Max Verstappen": "VER",
    "Lewis Hamilton": "HAM", "Charles Leclerc": "LEC", "Isack Hadjar": "HAD", "Andrea Kimi Antonelli": "ANT",
    "Yuki Tsunoda": "TSU", "Alexander Albon": "ALB", "Esteban Ocon": "OCO", "Nico Hülkenberg": "HUL",
    "Fernando Alonso": "ALO", "Lance Stroll": "STR", "Carlos Sainz Jr.": "SAI", "Pierre Gasly": "GAS",
    "Oliver Bearman": "BEA", "Jack Doohan": "DOO", "Gabriel Bortoleto": "BOR", "Liam Lawson": "LAW"
}

qualifying_2025['DriverCode'] = qualifying_2025['Driver'].map(driver_mapping)
print(qualifying_2025)

#Merge 2024 and 2025 data
merged_data = qualifying_2025.merge(meanSectors2024, left_on = 'DriverCode', right_on = 'Driver', how='left')
print(merged_data)

#Fix 1 - build target correctly
target_by_driver = laps2024.groupby('Driver')['LapTime'].mean()
merged_data['TargetLapTime'] = merged_data['DriverCode'].map(target_by_driver)

train_df = merged_data.dropna(
    subset=['TargetLapTime', 'Sector1Time', 'Sector2Time', 'Sector3Time']
)
X = train_df[['QualifyingTime (s)', 'Sector1Time', 'Sector2Time', 'Sector3Time']]
y = train_df['TargetLapTime'].values


X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=47)
model = GradientBoostingRegressor(
    n_estimators = 250,
    learning_rate = 0.1,
    max_depth = 4,
    random_state = 47
)
model.fit(X_train, y_train)

#Evaluate the model
y_pred = model.predict(X_test)
mae = mean_absolute_error(y_test, y_pred)
print(f"Mean Absolute Error: {mae:.3f} seconds")

#Predict(Fix) - only for drivers the model was trained on
predictedRaceTimes = model.predict(X)
predictedRaceTimes_df = pd.DataFrame({ 
    'Driver': train_df['DriverCode'],
    'PredictedRaceTime (s)': predictedRaceTimes
}).sort_values('PredictedRaceTime (s)')


print("\n🏁 Predicted 2025 Chinese GP Winner (Old drivers only) 🏁\n")
print(predictedRaceTimes_df)