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
import numpy as np
import pandas as pd
from sklearn.linear_model import LinearRegression, Ridge, Lasso
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import LabelEncoder, StandardScaler
from sklearn.metrics import r2_score
import statsmodels.api as sm
import warnings
warnings.filterwarnings('ignore')

all_cols = list(df.columns)
numeric_cols = [c for c in all_cols if pd.to_numeric(df[c], errors='coerce').notna().sum() > len(df) * 0.7]

target_col = numeric_cols[0] if len(numeric_cols) >= 2 else None
feature_cols = numeric_cols[1:] if len(numeric_cols) >= 2 else []

if target_col is None or len(feature_cols) == 0:
    result = {"error": "Need at least 2 numeric columns for regression."}
else:
    y = pd.to_numeric(df[target_col], errors='coerce')
    X = df[feature_cols].apply(pd.to_numeric, errors='coerce')

    # Encode categoricals
    for col in feature_cols:
        if df[col].dtype == object:
            le = LabelEncoder()
            X[col] = le.fit_transform(df[col].astype(str))

    # Drop nulls
    valid = X.dropna().index.intersection(y.dropna().index)
    X_clean = X.loc[valid]
    y_clean = y.loc[valid]

    if len(X_clean) < 10:
        result = {"error": f"Not enough valid rows ({len(X_clean)}) for regression."}
    else:
        # OLS regression with statsmodels for p-values
        X_const = sm.add_constant(X_clean)
        model = sm.OLS(y_clean, X_const).fit()

        predicted_full = [None] * len(df)
        residuals_full = [None] * len(df)
        for i, idx in enumerate(valid):
            predicted_full[idx] = float(model.fittedvalues.iloc[i])
            residuals_full[idx] = float(model.resid.iloc[i])

        coefficients = {col: round(float(val), 6)
                       for col, val in zip(['const'] + feature_cols, model.params)}
        pvalues = {col: round(float(val), 6)
                  for col, val in zip(['const'] + feature_cols, model.pvalues)}
        significant = [col for col in feature_cols if pvalues.get(col, 1) < 0.05]

        chart_data = [
            {"index": i, "Actual": float(y_clean.iloc[i]),
             "Predicted": float(model.fittedvalues.iloc[i])}
            for i in range(min(100, len(y_clean)))
        ]

        result = {
            "coefficients":        coefficients,
            "r_squared":           round(float(model.rsquared), 4),
            "adj_r_squared":       round(float(model.rsquared_adj), 4),
            "pvalues":             pvalues,
            "f_statistic":         round(float(model.fvalue), 4),
            "f_pvalue":            round(float(model.f_pvalue), 6),
            "Regression_predicted": predicted_full,
            "Regression_residual":  residuals_full,
            "significant_vars":    significant,
            "chartData":           chart_data,
            "interpretation":      f"Regression on {target_col}: R²={round(float(model.rsquared),3)}, significant vars: {significant if significant else 'none at p<0.05'}"
        }`,

    ml_models: `${BASE}
import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestClassifier, RandomForestRegressor
from sklearn.cluster import KMeans
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import LabelEncoder, StandardScaler
from sklearn.metrics import accuracy_score, r2_score, confusion_matrix
import warnings
warnings.filterwarnings('ignore')

# Identify target and feature columns from choices
# Target is the first numeric/category column, features are the rest
all_cols = list(df.columns)
numeric_cols = [c for c in all_cols if pd.to_numeric(df[c], errors='coerce').notna().sum() > len(df) * 0.7]
category_cols = [c for c in all_cols if c not in numeric_cols and str(c).lower() not in ['date','period','time','month','year','index']]

# Use first numeric as target, rest as features
target_col = numeric_cols[0] if numeric_cols else None
feature_cols = [c for c in numeric_cols if c != target_col]

if target_col is None or len(feature_cols) == 0:
    result = {"error": "Need at least 2 numeric columns for ML. Select a target and at least one feature."}
else:
    # Build feature matrix
    X_raw = df[feature_cols].copy()
    y_raw = df[target_col].copy()

    # Encode any categorical features
    le_dict = {}
    for col in feature_cols:
        if X_raw[col].dtype == object:
            le = LabelEncoder()
            X_raw[col] = le.fit_transform(X_raw[col].astype(str))
            le_dict[col] = le

    # Convert to numeric and drop nulls
    X_raw = X_raw.apply(pd.to_numeric, errors='coerce')
    y_raw = pd.to_numeric(y_raw, errors='coerce')
    valid_idx = X_raw.dropna().index.intersection(y_raw.dropna().index)
    X = X_raw.loc[valid_idx].values
    y = y_raw.loc[valid_idx].values

    if len(X) < 20:
        result = {"error": f"Not enough valid rows ({len(X)}) for ML. Need at least 20."}
    else:
        # Scale features
        scaler = StandardScaler()
        X_scaled = scaler.fit_transform(X)

        # Detect task type
        unique_y = len(np.unique(y))
        if unique_y <= 10 and unique_y < len(y) * 0.05:
            task_type = 'classification'
        else:
            task_type = 'regression'

        # Split — use 0.2 test size, handle small datasets
        test_size = 0.2 if len(X) >= 50 else 0.15
        X_train, X_test, y_train, y_test = train_test_split(
            X_scaled, y, test_size=test_size, random_state=42
        )

        predictions_full = np.full(len(df), np.nan)

        if task_type == 'classification':
            model = RandomForestClassifier(n_estimators=100, random_state=42, n_jobs=-1)
            model.fit(X_train, y_train)
            y_pred = model.predict(X_test)
            score = float(accuracy_score(y_test, y_pred))
            try:
                cm = confusion_matrix(y_test, y_pred).tolist()
            except Exception:
                cm = []
            # Full dataset predictions
            full_preds = model.predict(X_scaled)
            predictions_full[valid_idx] = full_preds
        else:
            model = RandomForestRegressor(n_estimators=100, random_state=42, n_jobs=-1)
            model.fit(X_train, y_train)
            y_pred = model.predict(X_test)
            score = float(r2_score(y_test, y_pred))
            cm = []
            full_preds = model.predict(X_scaled)
            predictions_full[valid_idx] = full_preds

        # Feature importance
        feat_imp = {col: round(float(imp), 4)
                    for col, imp in zip(feature_cols, model.feature_importances_)}
        feat_imp = dict(sorted(feat_imp.items(), key=lambda x: x[1], reverse=True))

        # Chart data — feature importance bar chart
        chart_data = [{"feature": k, "importance": v} for k, v in feat_imp.items()]

        # Predictions list — pad to full df length
        ML_prediction = [
            float(x) if not np.isnan(x) else None
            for x in predictions_full.tolist()
        ]

        result = {
            "task_type":      task_type,
            "accuracy_or_r2": round(score, 4),
            "feature_importance": feat_imp,
            "confusion_matrix": cm,
            "ML_prediction":  ML_prediction,
            "n_train":        int(len(X_train)),
            "n_test":         int(len(X_test)),
            "n_total":        int(len(X)),
            "target_col":     target_col,
            "feature_cols":   feature_cols,
            "chartData":      chart_data,
            "interpretation": f"Random Forest {task_type} on {target_col}: score={round(score,3)}, trained on {len(X_train)} rows, tested on {len(X_test)} rows. Top feature: {list(feat_imp.keys())[0]}"
        }`,
    
    stats_tests: `${BASE}
from scipy import stats
Run appropriate test based on choices: t-test, ANOVA, chi-square, Mann-Whitney, Shapiro-Wilk.
Compute effect size: Cohen's d for t-test, eta-squared for ANOVA, Cramer's V for chi-square.
result = {"test_name": "str", "statistic": 0.0, "p_value": 0.0, "reject_null": False, "effect_size": 0.0, "effect_label": "str", "conclusion": "plain English str", "group_means": {}}`,

financial: `${BASE}
import numpy as np
import pandas as pd

# Find numeric value column
value_col = None
for col in df.columns:
    if str(col).lower().strip() in ['date','period','time','month','year','index','day','week']:
        continue
    nums = pd.to_numeric(df[col], errors='coerce').dropna()
    if len(nums) > len(df) * 0.7 and nums.std() > 0:
        value_col = col
        break

if value_col is None:
    for col in df.columns:
        nums = pd.to_numeric(df[col], errors='coerce').dropna()
        if len(nums) > 10:
            value_col = col
            break

if value_col is None:
    result = {"error": "No numeric column found"}
else:
    n_rows = len(df)
    series = pd.to_numeric(df[value_col], errors='coerce').fillna(method='ffill').dropna()
    returns = series.pct_change().dropna() * 100
    mean_r = float(returns.mean())
    std_r = max(float(returns.std()), 0.0001)

    # GARCH(1,1) implemented in pure numpy — no arch library needed
    omega, alpha, beta = 0.1, 0.1, 0.8
    n = len(returns)
    sigma2 = np.zeros(n)
    sigma2[0] = float(returns.var())
    ret_arr = returns.values
    for t in range(1, n):
        sigma2[t] = omega + alpha * ret_arr[t-1]**2 + beta * sigma2[t-1]
    garch_vol = list(np.sqrt(sigma2))

    # Pad to full dataset length
    pad = n_rows - len(garch_vol)
    garch_padded = [None] * pad + [float(x) for x in garch_vol]

    ret_list = returns.tolist()
    ret_pad = n_rows - len(ret_list)
    returns_padded = [None] * ret_pad + [float(x) for x in ret_list]

    # Risk metrics
    var_95 = float(np.percentile(returns, 5))
    var_99 = float(np.percentile(returns, 1))
    below = returns[returns <= var_95]
    cvar_95 = float(below.mean()) if len(below) > 0 else var_95
    sharpe = float(mean_r / std_r * np.sqrt(252))
    neg = returns[returns < 0]
    down_std = float(neg.std()) if len(neg) > 1 else std_r
    sortino = float(mean_r / down_std * np.sqrt(252)) if down_std > 0 else 0.0
    cumul = (1 + returns / 100).cumprod()
    max_dd = float(((cumul - cumul.cummax()) / cumul.cummax()).min())
    ann_ret = float(mean_r * 252)
    ann_vol = float(std_r * np.sqrt(252))

    chart_data = [
        {"index": i, "GARCH_volatility": g, "Returns": r}
        for i, (g, r) in enumerate(zip(garch_padded, returns_padded))
        if g is not None and r is not None
    ]

    result = {
        "GARCH_volatility":  garch_padded,
        "Returns":           returns_padded,
        "chartData":         chart_data,
        "var_95":            round(var_95, 4),
        "var_99":            round(var_99, 4),
        "cvar_95":           round(cvar_95, 4),
        "sharpe_ratio":      round(sharpe, 4),
        "sortino_ratio":     round(sortino, 4),
        "max_drawdown":      round(max_dd, 4),
        "annualised_return": round(ann_ret, 4),
        "annualised_vol":    round(ann_vol, 4),
        "interpretation":    f"{value_col}: Sharpe {round(sharpe,2)}, Ann.Return {round(ann_ret,2)}%, Max DD {round(max_dd*100,2)}%, Avg Vol {round(std_r,2)}%"
    }`,

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
