import spacy

_nlp = None


def get_nlp():
    global _nlp
    if _nlp is None:
        _nlp = spacy.load("en_core_web_sm")
    return _nlp


def extract_entities(text: str) -> list[dict]:
    """Extract named entities using spaCy. Returns list of {name, type, start, end}."""
    if not text or not text.strip():
        return []

    nlp = get_nlp()
    doc = nlp(text[:10000])  # cap to avoid memory issues

    entities = []
    seen = set()

    for ent in doc.ents:
        if ent.label_ in ("PERSON", "ORG", "GPE", "PRODUCT", "EVENT", "WORK_OF_ART"):
            key = (ent.text.lower(), ent.label_)
            if key not in seen:
                seen.add(key)
                entities.append({
                    "name": ent.text,
                    "type": ent.label_,
                    "start": ent.start_char,
                    "end": ent.end_char,
                })

    return entities
