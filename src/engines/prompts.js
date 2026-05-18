// src/engines/prompts.js
const BASE = `You write Python code for data analysis.
Rules:
- DataFrame is ALWAYS called 'df' (already loaded)
- NEVER use return at the top level — last line must be a bare variable name or dict literal
- All values in result dict must be JSON-serialisable (use .item() for numpy scalars, .tolist() for arrays)
- Wrap everything in try/except — on error: result = {"error": str(e)}
- Return ONLY Python code. No markdown. No backticks. No return keyword at top level.`

export function getCodeWriterPrompt(category) {
  const prompts = {
    charts: `${BASE}
Aggregate data for charting with pandas groupby/pivot_table/resample.
result = {"chartData": [{"x_col": val, "y_col": val}], "title": "str", "summary": "one sentence insight"}`,

    eda: `${BASE}
import pandas as pd; import numpy as np
Compute: describe(), skewness, kurtosis, correlation matrix, null counts, IQR outliers.
result = {"summary_stats": {}, "skewness": {}, "kurtosis": {}, "correlations": {}, "null_counts": {}, "outlier_counts": {}, "recommendations": ["actionable string"]}`,

    data_quality: `${BASE}
Check nulls, duplicates, Z-score outliers (>3), type issues, constant columns.
quality_score = 100 - (null_pct + duplicate_pct + outlier_pct) capped at 0.
result = {"null_report": {}, "duplicate_count": 0, "outlier_report": {}, "type_issues": [], "constant_cols": [], "quality_score": 0.0, "suggestions": []}`,

    regression: `${BASE}
from sklearn.linear_model import LinearRegression, Ridge, Lasso
from sklearn.preprocessing import LabelEncoder
from sklearn.metrics import r2_score
import statsmodels.api as sm
Encode categoricals, drop nulls, fit model, compute R2, coefficients, residuals.
Store predicted as Regression_predicted and residuals as Regression_residual lists.
result = {"coefficients": {}, "r_squared": 0.0, "adj_r_squared": 0.0, "predicted": [], "residuals": [], "significant_vars": [], "interpretation": "str", "Regression_predicted": [], "Regression_residual": []}`,

    ml_models: `${BASE}
from sklearn.ensemble import RandomForestClassifier, RandomForestRegressor
from sklearn.cluster import KMeans
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import LabelEncoder, StandardScaler
from sklearn.metrics import accuracy_score, r2_score
Detect task: classification if target is categorical, clustering if no target, else regression.
Split 80/20, fit, evaluate. Store predictions as ML_prediction list.
result = {"task_type": "str", "accuracy_or_r2": 0.0, "feature_importance": {}, "predictions": [], "n_train": 0, "n_test": 0, "ML_prediction": []}`,

    stats_tests: `${BASE}
from scipy import stats
Run appropriate test based on choices: t-test, ANOVA, chi-square, Mann-Whitney, Shapiro-Wilk.
Compute effect size: Cohen's d for t-test, eta-squared for ANOVA, Cramer's V for chi-square.
result = {"test_name": "str", "statistic": 0.0, "p_value": 0.0, "reject_null": False, "effect_size": 0.0, "effect_label": "str", "conclusion": "plain English str", "group_means": {}}`,

    financial: `${BASE}
import numpy as np
try:
    from arch import arch_model
    ARCH_AVAILABLE = True
except: ARCH_AVAILABLE = False

Compute log returns, then:
- If ARCH_AVAILABLE: fit GARCH(1,1) and get volatility forecast
- Else: use rolling std as volatility proxy
- VaR_95 = returns.quantile(0.05), CVaR_95 = returns[returns<=VaR_95].mean()
- Sharpe = mean_return/std_return * np.sqrt(252)
- Sortino = mean_return/downside_std * np.sqrt(252)
- Max drawdown from cumulative returns
- Store GARCH_volatility list for memory
result = {"volatility_series": [], "garch_volatility": [], "var_95": 0.0, "var_99": 0.0, "cvar_95": 0.0, "sharpe_ratio": 0.0, "sortino_ratio": 0.0, "max_drawdown": 0.0, "annualised_return": 0.0, "annualised_vol": 0.0, "interpretation": "str", "GARCH_volatility": []}`,

    marketing: `${BASE}
import pandas as pd; import numpy as np
RFM scoring: score each entity 1-5 on Recency (days since last), Frequency (count), Monetary (sum).
Use pd.qcut with duplicates='drop'. Label: 555=Champion, dropping R=At Risk, low all=Lost.
CLV = avg_order * avg_frequency * 12.
Churn = last purchase > 90 days ago.
Store RFM_segment, CLV_estimated, Churn_risk as lists for memory.
result = {"rfm_segments": {}, "segment_revenue": {}, "clv_by_segment": {}, "churn_rate": 0.0, "active_customers": 0, "rfm_values": [], "clv_values": [], "churn_values": []}`,

    hr: `${BASE}
from scipy import stats
Attrition rate = rows where attrition/left=1 or 'Yes' / total * 100.
Group attrition by dept and tenure bucket (<1yr,1-3yr,3-5yr,5+yr).
If gender/sex column exists: t-test on salary by gender.
Tenure buckets and performance distribution.
result = {"attrition_rate": 0.0, "attrition_by_dept": {}, "attrition_by_tenure": {}, "pay_equity": {}, "pay_gap_pct": None, "pay_gap_significant": None, "avg_tenure": 0.0, "headcount": 0, "top_attrition_drivers": []}`,

    operations: `${BASE}
ABC: sort by value desc, cumulative % → A=top 80%, B=next 15%, C=last 5%.
SPC: UCL=mean+3*std, LCL=mean-3*std, flag out-of-control points.
OEE = availability * performance * quality if those columns exist.
EOQ = sqrt(2*demand*order_cost/holding_cost) if relevant columns exist.
result = {"abc_a": [], "abc_b": [], "abc_c": [], "abc_summary": {}, "control_ucl": 0.0, "control_lcl": 0.0, "control_mean": 0.0, "out_of_control_count": 0, "oee": None, "interpretation": "str"}`,

    text_nlp: `${BASE}
from collections import Counter; import re
STOPWORDS = {'the','a','an','and','or','but','in','on','at','to','for','of','with','by','is','was','are','were','i','you','he','she','it','we','they','this','that','not','no'}
POSITIVE = {'good','great','excellent','amazing','best','love','happy','perfect','fantastic','positive','nice','helpful','wonderful','outstanding'}
NEGATIVE = {'bad','poor','terrible','awful','worst','hate','horrible','negative','disappointing','useless','broken','slow','expensive','difficult','wrong'}
Clean text, count words (remove stopwords), classify sentiment per row, find bigrams.
result = {"sentiment_distribution": {"positive": 0.0, "negative": 0.0, "neutral": 0.0}, "sentiment_by_row": [], "top_keywords": [], "top_bigrams": [], "avg_word_count": 0.0, "vocabulary_size": 0}`,

    report: `${BASE}
Compute high-level summary across all columns.
result = {"row_count": 0, "column_count": 0, "numeric_summary": {}, "categorical_summary": {}, "data_quality_score": 0.0, "key_insights": ["5 specific strings"], "recommended_analyses": ["3 specific strings"]}`
  }
  return prompts[category] || prompts.eda
}

export const VARIABLE_PICKER_CONFIG = {
  charts: {
    chart_type: { label:'Chart type', multi:false, options:['Line','Bar','Scatter','Histogram','Box plot','Area','Pie','Heatmap','Waterfall'] },
    x_column:   { label:'X axis',    multi:false, types:['date','category','numeric'] },
    y_columns:  { label:'Y axis',    multi:true,  types:['numeric'] },
    color_by:   { label:'Colour by (optional)', multi:false, types:['category'], optional:true }
  },
  eda: {
    columns: { label:'Columns to explore', multi:true, types:['numeric','category','date'] }
  },
  data_quality: {
    columns: { label:'Columns to audit', multi:true, types:['numeric','category','date','text'] }
  },
  regression: {
    target:     { label:'Target variable (Y)',   multi:false, types:['numeric'] },
    features:   { label:'Feature variables (X)', multi:true,  types:['numeric','category'] },
    model_type: { label:'Model type', multi:false, options:['Linear','Ridge','Lasso'] }
  },
  ml_models: {
    target:    { label:'Target to predict (Y)', multi:false, types:['numeric','category'] },
    features:  { label:'Feature columns (X)',   multi:true,  types:['numeric','category'] },
    algorithm: { label:'Algorithm', multi:false, options:['Random Forest','Logistic Regression','K-Means Clustering'] }
  },
  stats_tests: {
    metric:    { label:'Metric to test (numeric)', multi:false, types:['numeric'] },
    group_by:  { label:'Group by column',          multi:false, types:['category'] },
    test_type: { label:'Test type', multi:false, options:['t-test','ANOVA','Chi-square','Mann-Whitney','Shapiro-Wilk'] }
  },
  financial: {
    value_column:  { label:'Price / value series', multi:false, types:['numeric'] },
    date_column:   { label:'Date column',          multi:false, types:['date'] },
    analysis_type: { label:'Analysis type', multi:false, options:['GARCH Volatility','VaR & CVaR','Sharpe & Sortino Ratios','Max Drawdown','Full Financial Report'] }
  },
  marketing: {
    customer_id:   { label:'Customer / entity ID', multi:false, types:['category','numeric'] },
    monetary:      { label:'Monetary value',        multi:false, types:['numeric'] },
    date_column:   { label:'Transaction date',      multi:false, types:['date'] },
    analysis_type: { label:'Analysis type', multi:false, options:['RFM Segmentation','CLV Calculation','Churn Prediction','Full Marketing Report'] }
  },
  hr: {
    analysis_type: { label:'Analysis type', multi:false, options:['Attrition Analysis','Pay Equity Audit','Tenure Distribution','Full HR Report'] }
  },
  operations: {
    metric_column: { label:'Key metric column',    multi:false, types:['numeric'] },
    item_column:   { label:'Item / SKU / product', multi:false, types:['category'] },
    date_column:   { label:'Date column (optional)', multi:false, types:['date'], optional:true },
    analysis_type: { label:'Analysis type', multi:false, options:['OEE Calculation','ABC Inventory Analysis','SPC Control Chart','Demand Forecast','Full Operations Report'] }
  },
  text_nlp: {
    text_column:   { label:'Text column',  multi:false, types:['text'] },
    analysis_type: { label:'Analysis type', multi:false, options:['Sentiment Analysis','Keyword Extraction','Full NLP Report'] }
  },
  report: {
    include_sections: { label:'Sections to include', multi:true, options:['Summary Statistics','Data Quality','Key Insights','Charts','Recommendations'] }
  }
}
