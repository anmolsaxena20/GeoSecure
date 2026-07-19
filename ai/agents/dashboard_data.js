const dashboardData = {
  "reserve_status": {
    "capacity_barrels": 100000000,
    "current_fill_barrels": 90000000,
    "fill_ratio_percent": 90,
    "cover_days": 20,
    "safety_status": "SAFE",
    "deviation_from_target_barrels": 0
  },
  "oil_prices": {
    "brent_price": 84.81,
    "wti_price": 78.5,
    "average_price": 81.66,
    "trend_direction": "UP",
    "volatility": 1.25
  },
  "commercial_inventory": {
    "inventory_level_million_barrels": 120,
    "trend": "INCREASING",
    "coverage_days": 30
  },
  "decision": {
    "action": "HOLD",
    "recommended_volume_barrels": 0,
    "procurement_rate_barrels_per_day": 0,
    "estimated_cost_usd": 0,
    "confidence_score_percent": 70,
    "urgency": "",
    "explainable_rationale": ""
  },
  "forecasts": {
    "forecast_30d": 85,
    "forecast_60d": 90,
    "forecast_90d": 95
  },
  "supply_risk": {
    "risk_score": 70,
    "risk_level": "MODERATE",
    "geopolitical_risk": 20,
    "weather_risk": 10,
    "disaster_risk": 10,
    "inventory_risk": 30
  },
  "depletion_prediction": {
    "days_remaining_normal": 60,
    "days_remaining_disrupted": 30,
    "depletion_date_normal": "2026-08-15",
    "depletion_date_disrupted": "2026-08-01"
  },
  "scenarios": [
    {
      "name": "Strait of Hormuz Blockade",
      "simulated_price_shock_percent": 20,
      "simulated_import_reduction_percent": 30,
      "simulated_risk_score": 90,
      "depletion_days_remaining": 20,
      "recommended_response": "BUY"
    },
    {
      "name": "OPEC Cut",
      "simulated_price_shock_percent": 15,
      "simulated_import_reduction_percent": 20,
      "simulated_risk_score": 80,
      "depletion_days_remaining": 40,
      "recommended_response": "HOLD"
    },
    {
      "name": "Gulf Hurricane",
      "simulated_price_shock_percent": 10,
      "simulated_import_reduction_percent": 15,
      "simulated_risk_score": 70,
      "depletion_days_remaining": 50,
      "recommended_response": "HOLD"
    }
  ],
  "alerts": [
    {
      "type": "LOW_RESERVES",
      "severity": "LOW",
      "message": "Reserve level is below 80%"
    }
  ],
  "historical_performance": {
    "total_decisions_logged": 29,
    "previous_decision": "BUY",
    "average_logged_risk_score": 70
  },
  "market_condition": {
    "price_status": "FAIRLY_VALUED",
    "market_sentiment": "NEUTRAL",
    "volatility_level": "MEDIUM"
  },
  "target_reserve_info": {
    "target_fill_percent": 90,
    "recommended_reserve_level_barrels": 90000000,
    "reserve_deficit_surplus_barrels": 0
  },
  "optimization_score": {
    "overall_optimization_score": 80
  },
  "decision_factors": [
    {
      "factor": "Risk Score",
      "weight_importance": 0.3
    },
    {
      "factor": "Price Trend",
      "weight_importance": 0.2
    },
    {
      "factor": "Inventory Level",
      "weight_importance": 0.2
    },
    {
      "factor": "Weather Risk",
      "weight_importance": 0.1
    },
    {
      "factor": "Disaster Risk",
      "weight_importance": 0.1
    },
    {
      "factor": "Geopolitical Risk",
      "weight_importance": 0.1
    }
  ],
  "procurement_window": {
    "best_time_to_procure": "2026-08-01",
    "suggested_purchase_timeline": "2026-08-01 to 2026-08-15"
  },
  "reserve_sufficiency": {
    "days_of_supply_normal_demand": 60,
    "days_of_supply_peak_demand": 30,
    "days_of_supply_emergencies": 20
  },
  "economic_impact": {
    "estimated_procurement_cost_usd": 100000000,
    "potential_cost_savings_usd": 50000000,
    "budget_impact": "POSITIVE"
  },
  "decision_confidence": {
    "confidence_level": "HIGH"
  },
  "explainable_ai": {
    "top_contributing_factors": [
      "Risk Score",
      "Price Trend",
      "Inventory Level"
    ],
    "expected_outcomes": "The decision to hold is based on the current risk score, price trend, and inventory level. The expected outcome is a stable market with minimal price fluctuations."
  }
};
