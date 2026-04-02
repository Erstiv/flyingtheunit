from sentence_transformers import SentenceTransformer

_model = None


def get_model() -> SentenceTransformer:
    global _model
    if _model is None:
        _model = SentenceTransformer("all-MiniLM-L6-v2")
    return _model


def generate_embedding(text: str) -> list[float]:
    """Generate a 384-dim embedding for text."""
    if not text or not text.strip():
        return [0.0] * 384

    model = get_model()
    embedding = model.encode(text[:2000], normalize_embeddings=True)
    return embedding.tolist()
