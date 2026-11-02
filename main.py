import joblib
model=joblib.load('Mental Health Predictor.pkl')
from fastapi import FastAPI, Path, HTTPException, Query
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field, computed_field
from typing import Annotated, Literal
import json
import pandas as pd
app=FastAPI()
from fastapi.middleware.cors import CORSMiddleware

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://127.0.0.1:5500",
        "http://localhost:5500",
        "null",   # only needed if you open index.html by double-clicking it
    ],
    allow_methods=["POST", "GET"],
    allow_headers=["Content-Type"],
)
class Student_data(BaseModel):
    Age                    : int = Field(...,ge=0, le=100,)
    Gender                 : str = Literal['Male','Female']
    Country                : str
    Academic_Level         :Literal['Undergraduate', 'Graduate', 'High School']
    Most_Used_Platform     :Literal['Facebook', 'LinkedIn', 'Instagram', 'Snapchat', 'Twitter',
       'YouTube', 'TikTok', 'LINE', 'KakaoTalk', 'VKontakte', 'WhatsApp',
       'WeChat']
    Purpose_Of_Use         :Literal['Networking', 'Education', 'Entertainment', 'News']
    Avg_Daily_Usage_Hours  : float = Field(...,ge=0, le=24)
    Daily_Unlocks          : int = Field(...,ge=0)
    Study_Hours            : float = Field(..., ge=0, le=24)
    Physical_Activity_Hours: float = Field(...,ge=0,le=24)
    Sleep_Hours_Per_Night  : float = Field(...,ge=0,le=24)
    Stress_Level           :Literal['Medium', 'Low', 'Very High', 'High']
    
@app.get('/')
def greet():
    return {'Hello Users!!!'}

top_countries=['Other',
 'India',
 'USA',
 'Canada',
 'Australia',
 'UK',
 'Germany',
 'Mexico',
 'Turkey',
 'France']

class predictionResponse(BaseModel):
   predicted_mental_health_score : float

def group_countries(country):
  if country in top_countries:
    return country
  else:
    return 'Other'
  
@app.post('/predict')
def predict(data: Student_data, response_model=predictionResponse):
    country_group=group_countries(data.Country)
    input_row=pd.DataFrame([{
        'Age':data.Age,
        'Gender':data.Gender,
        'Country':data.Country,
        'Academic_Level':data.Academic_Level,
        'Most_Used_Platform':data.Most_Used_Platform,
        'Purpose_Of_Use':data.Purpose_Of_Use,
        'Avg_Daily_Usage_Hours':data.Avg_Daily_Usage_Hours,
        'Daily_Unlocks':data.Daily_Unlocks,
        'Study_Hours':data.Study_Hours,
        'Physical_Activity_Hours':data.Physical_Activity_Hours,
        'Sleep_Hours_Per_Night':data.Sleep_Hours_Per_Night,
        'Stress_Level':data.Stress_Level,
        'grouped_countries':country_group
    }])

    prediction=model.predict(input_row)[0]

    return predictionResponse(predicted_mental_health_score=round(float(prediction), 3))