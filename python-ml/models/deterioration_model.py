"""
Deterioration Forecasting Model — Facebook Prophet + Linear Regression

Predicts the patient's risk trajectory for the next 7 days so caregivers
get an early warning flag before the patient crosses into ELEVATED_RISK
or CRITICAL, rather than reacting after the fact.

Falls back to linear regression when Prophet is unavailable or data is sparse.
"""

import numpy as np
import pandas as pd
from datetime import datetime, timedelta

try:
    from prophet import Prophet
    PROPHET_AVAILABLE = True
except ImportError:
    PROPHET_AVAILABLE = False

from sklearn.linear_model import LinearRegression
from utils.feature_engineering import logs_to_dataframe, compute_rule_based_delta, FEATURE_COLUMNS


def _logs_to_risk_series(logs: list[dict]) -> pd.DataFrame:
    """
    Build a daily risk-score time series from raw logs.
    Uses the rule-based delta accumulated over time — same logic as riskEngine.js
    but re-wound from scratch so we get a clean signal.
    """
    rows = []
    cumulative = 50.0
    for log in logs:
        delta      = compute_rule_based_delta(log)
        cumulative = float(np.clip(cumulative + delta * 0.4, 0, 100))
        date       = log.get("date")
        if isinstance(date, str):
            date = datetime.fromisoformat(date.replace("Z", "+00:00"))
        rows.append({"ds": pd.Timestamp(date).normalize(), "y": cumulative})

    df = pd.DataFrame(rows).sort_values("ds").drop_duplicates("ds")
    return df


def _label_forecast(score: float) -> str:
    if score >= 70: return "CRITICAL"
    if score >= 40: return "ELEVATED_RISK"
    if score >= 20: return "MILD_RISK"
    return "STABLE"


class DeteriorationModel:

    def predict(self, logs: list[dict], horizon_days: int = 7) -> dict:
        """
        Forecast risk score for the next `horizon_days` days.

        Returns:
          forecast        : list of {date, predicted_score, risk_level}
          trend           : "improving" | "stable" | "worsening"
          early_warning   : bool — True if any forecast day hits ELEVATED_RISK+
          peak_risk_score : highest predicted score in the window
          model           : which model was used
        """
        if len(logs) < 5:
            return self._insufficient_data()

        series = _logs_to_risk_series(logs)

        if PROPHET_AVAILABLE and len(series) >= 10:
            return self._prophet_forecast(series, horizon_days)
        else:
            return self._linear_forecast(series, horizon_days)

    # ── Prophet ─────────────────────────────────────────────────────────────

    def _prophet_forecast(self, series: pd.DataFrame, horizon: int) -> dict:
        try:
            m = Prophet(
                yearly_seasonality=False,
                weekly_seasonality=True,
                daily_seasonality=False,
                changepoint_prior_scale=0.15,   # moderate flexibility
                interval_width=0.80,
            )
            m.fit(series)

            future = m.make_future_dataframe(periods=horizon, freq="D")
            fc     = m.predict(future)

            # Only return the forecast horizon (future rows)
            fc_future = fc.tail(horizon)[["ds", "yhat", "yhat_lower", "yhat_upper"]].copy()
            fc_future["yhat"]       = fc_future["yhat"].clip(0, 100)
            fc_future["yhat_lower"] = fc_future["yhat_lower"].clip(0, 100)
            fc_future["yhat_upper"] = fc_future["yhat_upper"].clip(0, 100)

            forecast_rows = [
                {
                    "date":            row["ds"].strftime("%Y-%m-%d"),
                    "predicted_score": round(float(row["yhat"]), 1),
                    "lower_bound":     round(float(row["yhat_lower"]), 1),
                    "upper_bound":     round(float(row["yhat_upper"]), 1),
                    "risk_level":      _label_forecast(row["yhat"]),
                }
                for _, row in fc_future.iterrows()
            ]

            scores       = [r["predicted_score"] for r in forecast_rows]
            peak         = max(scores)
            first, last  = scores[0], scores[-1]
            delta        = last - first
            trend        = "worsening" if delta > 5 else "improving" if delta < -5 else "stable"
            early_warning = any(r["risk_level"] in ("ELEVATED_RISK", "CRITICAL") for r in forecast_rows)

            return {
                "forecast":        forecast_rows,
                "trend":           trend,
                "early_warning":   early_warning,
                "peak_risk_score": round(peak, 1),
                "model":           "prophet",
            }
        except Exception as e:
            # Prophet failed — fall back to linear
            return self._linear_forecast(series, horizon)

    # ── Linear regression fallback ───────────────────────────────────────────

    def _linear_forecast(self, series: pd.DataFrame, horizon: int) -> dict:
        X = np.arange(len(series)).reshape(-1, 1).astype(float)
        y = series["y"].values

        reg = LinearRegression()
        reg.fit(X, y)

        last_x   = len(series)
        last_date = series["ds"].iloc[-1]

        forecast_rows = []
        for i in range(1, horizon + 1):
            pred_score = float(np.clip(reg.predict([[last_x + i - 1]])[0], 0, 100))
            forecast_rows.append({
                "date":            (last_date + timedelta(days=i)).strftime("%Y-%m-%d"),
                "predicted_score": round(pred_score, 1),
                "lower_bound":     round(max(0, pred_score - 8), 1),
                "upper_bound":     round(min(100, pred_score + 8), 1),
                "risk_level":      _label_forecast(pred_score),
            })

        scores       = [r["predicted_score"] for r in forecast_rows]
        peak         = max(scores)
        delta        = scores[-1] - scores[0]
        trend        = "worsening" if delta > 5 else "improving" if delta < -5 else "stable"
        early_warning = any(r["risk_level"] in ("ELEVATED_RISK", "CRITICAL") for r in forecast_rows)

        return {
            "forecast":        forecast_rows,
            "trend":           trend,
            "early_warning":   early_warning,
            "peak_risk_score": round(peak, 1),
            "model":           "linear_regression",
        }

    def _insufficient_data(self) -> dict:
        return {
            "forecast":        [],
            "trend":           "unknown",
            "early_warning":   False,
            "peak_risk_score": None,
            "model":           "none",
            "message":         "Need at least 5 daily logs to generate a forecast.",
        }


# Singleton
deterioration_model = DeteriorationModel()