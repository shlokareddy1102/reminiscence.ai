# python-ml

FastAPI-based ML service scaffold for risk prediction, anomaly detection, deterioration forecasting, and intervention recommendations.

## Endpoints

- `GET /health`
- `POST /train`
- `POST /risk/predict`
- `POST /anomaly/detect`
- `POST /deterioration/forecast`
- `POST /intervention/recommend`

## Notes

- Trained artifacts are saved in `python-ml/artifacts/`.
- MongoDB connection defaults to `mongodb://127.0.0.1:27017/reminiscence`.
- Prophet is optional at runtime, but listed in requirements for the forecasting model.
