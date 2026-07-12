const dashboardData = {
  "reserve_status": {
    "capacity_barrels": 100000000,
    "current_fill_barrels": 100000000,
    "fill_ratio_percent": 100,
    "cover_days": 22.22,
    "safety_status": "SAFE",
    "deviation_from_target_barrels": 10000000
  },
  "oil_prices": {
    "brent_price": 74.2,
    "wti_price": 69.56,
    "average_price": 71.88,
    "trend_direction": "DOWN",
    "volatility": 1.25
  },
  "commercial_inventory": {
    "inventory_level_million_barrels": 100,
    "trend": "DECREASING",
    "coverage_days": 20
  },
  "decision": {
    "action": "RELEASE",
    "recommended_volume_barrels": 10000000,
    "procurement_rate_barrels_per_day": 4500000,
    "estimated_cost_usd": 718800000,
    "confidence_score_percent": 80,
    "urgency": "HIGH",
    "explainable_rationale": "Supply chain unpreparedness and geopolitical risks necessitate a strategic reserve replenishment."
  },
  "forecasts": {
    "forecast_30d": 75.12,
    "forecast_60d": 78.56,
    "forecast_90d": 81.99
  },
  "supply_risk": {
    "risk_score": 60,
    "risk_level": "MODERATE",
    "geopolitical_risk": 30,
    "weather_risk": 10,
    "disaster_risk": 20,
    "inventory_risk": 0
  },
  "depletion_prediction": {
    "days_remaining_normal": 30,
    "days_remaining_disrupted": 15,
    "depletion_date_normal": "2026-08-11",
    "depletion_date_disrupted": "2026-08-04"
  },
  "scenarios": [
    {
      "name": "UK Supply Chain Unpreparedness",
      "simulated_price_shock_percent": 15,
      "simulated_import_reduction_percent": 20,
      "simulated_risk_score": 70,
      "depletion_days_remaining": 10,
      "recommended_response": "IMMEDIATE PROCUREMENT"
    },
    {
      "name": "Strait of Hormuz Blockade",
      "simulated_price_shock_percent": 25,
      "simulated_import_reduction_percent": 30,
      "simulated_risk_score": 80,
      "depletion_days_remaining": 5,
      "recommended_response": "URGENT PROCUREMENT"
    },
    {
      "name": "OPEC Cut",
      "simulated_price_shock_percent": 10,
      "simulated_import_reduction_percent": 15,
      "simulated_risk_score": 50,
      "depletion_days_remaining": 20,
      "recommended_response": "STRATEGIC PROCUREMENT"
    }
  ],
  "alerts": [
    {
      "type": "LOW RESERVES",
      "severity": "HIGH",
      "message": "Strategic reserve levels critically low; immediate replenishment necessary."
    }
  ],
  "historical_performance": {
    "total_decisions_logged": 27,
    "previous_decision": "BUY",
    "average_logged_risk_score": 60
  },
  "market_condition": {
    "price_status": "FAIRLY VALUED",
    "market_sentiment": "NEUTRAL",
    "volatility_level": "MEDIUM"
  },
  "target_reserve_info": {
    "target_fill_percent": 90,
    "recommended_reserve_level_barrels": 90000000,
    "reserve_deficit_surplus_barrels": 10000000
  },
  "optimization_score": {
    "overall_optimization_score": 80
  },
  "decision_factors": [
    {
      "factor": "Supply Chain Unpreparedness",
      "weight_importance": 0.4
    },
    {
      "factor": "Geopolitical Risks",
      "weight_importance": 0.3
    },
    {
      "factor": "Weather Disruptions",
      "weight_importance": 0.2
    },
    {
      "factor": "Inventory Levels",
      "weight_importance": 0.1
    }
  ],
  "procurement_window": {
    "best_time_to_procure": "NOW",
    "suggested_purchase_timeline": "IMMEDIATE PROCUREMENT"
  },
  "reserve_sufficiency": {
    "days_of_supply_normal_demand": 30,
    "days_of_supply_peak_demand": 20,
    "days_of_supply_emergencies": 15
  },
  "economic_impact": {
    "estimated_procurement_cost_usd": 718800000,
    "potential_cost_savings_usd": 0,
    "budget_impact": "CRITICAL"
  },
  "decision_confidence": {
    "confidence_level": "HIGH"
  },
  "explainable_ai": {
    "top_contributing_factors": [
      "Supply Chain Unpreparedness",
      "Geopolitical Risks"
    ],
    "expected_outcomes": "Strategic reserve replenishment necessary to mitigate risks and ensure supply chain resilience."
  }
};
