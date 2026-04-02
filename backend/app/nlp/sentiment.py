from vaderSentiment.vaderSentiment import SentimentIntensityAnalyzer

_analyzer = None


def get_analyzer() -> SentimentIntensityAnalyzer:
    global _analyzer
    if _analyzer is None:
        _analyzer = SentimentIntensityAnalyzer()
    return _analyzer


def analyze_sentiment(text: str) -> dict:
    """Analyze sentiment using VADER. Returns score (-1 to 1) and label."""
    if not text or not text.strip():
        return {"score": 0.0, "label": "neutral"}

    analyzer = get_analyzer()
    scores = analyzer.polarity_scores(text)
    compound = scores["compound"]

    if compound >= 0.05:
        label = "positive"
    elif compound <= -0.05:
        label = "negative"
    else:
        label = "neutral"

    return {
        "score": compound,
        "label": label,
        "detail": {
            "positive": scores["pos"],
            "negative": scores["neg"],
            "neutral": scores["neu"],
        },
    }
