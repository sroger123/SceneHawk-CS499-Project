#!/usr/bin/env python3
"""Step 11 - a general LLM takes the same test as the fine-tuned model.

Sends the answer-key reviews to an OpenAI model and writes its labels in the
format eval/score.py reads, so the LLM is scored exactly like the other systems.
It sees review text only. The answer key's labels are dropped on load, so they
cannot reach a request.

The prompt is the one that wrote the training labels, read from
notebooks/scenehawk_llm_labeling.ipynb rather than copied, so the two cannot
drift apart.

One run is the result. Changing the prompt after seeing its score would turn the
answer key into a tuning set. Every reply is saved as it arrives, so a failed
request is retried without paying again for the rest, and rescoring never needs
another run. The raw replies quote reviews, so they stay out of git; the labels
written to eval/preds/ are ids and 0/1 only.

An LLM answers yes or no, so there is nothing to tune: the thresholds file is a
flat 0.5, there because eval/compare.py needs one for every system.

Needs OPENAI_API_KEY in chatbot/.env.

Run:  python scripts/11_llm_answer_key.py          # estimate only, spends nothing
      python scripts/11_llm_answer_key.py --test   # one call on a made-up review
      python scripts/11_llm_answer_key.py --run    # the real run
Out:  eval/preds/gpt55_answer_key.jsonl, eval/thresholds_gpt55.json,
      eval/gpt55_run.json, eval/llm_raw/gpt55.jsonl (gitignored)
"""
import argparse
import concurrent.futures as cf
import hashlib
import json
import os
import re
import sys
import threading
import time
from pathlib import Path

import requests
from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parent.parent          # chatbot/
load_dotenv(ROOT / ".env")

NOTEBOOK = ROOT / "notebooks" / "scenehawk_llm_labeling.ipynb"
TRAIN = ROOT / "data" / "training"
EVAL = ROOT / "eval"
NAME = "gpt55"
RAW = EVAL / "llm_raw" / f"{NAME}.jsonl"
PREDS = EVAL / "preds" / f"{NAME}_answer_key.jsonl"
THRESHOLDS = EVAL / f"thresholds_{NAME}.json"
RUN_RECORD = EVAL / f"{NAME}_run.json"
URL = "https://api.openai.com/v1/chat/completions"

# A dated snapshot, so the result names one fixed model rather than an alias
# that can change underneath it.
MODEL = "gpt-5.5-2026-04-23"

# Default reasoning, so this is GPT as people normally get it, and no
# temperature, because OpenAI's guide to its newer models says to remove it while
# reasoning is on. The token limit has to leave room for reasoning, which counts
# against it.
MAX_TOKENS = 4000

# Per 1M tokens, from OpenAI's pricing page, checked 2026-10-31.
PRICE_INPUT, PRICE_CACHED, PRICE_OUTPUT = 5.00, 0.50, 30.00

WORKERS = 6
TRIES = 4
MAX_COST = 15.00       # stops the run, in dollars; replies so far stay saved


def load_prompt(feelings):
    """SYSTEM and build_messages, from the labelling notebook's prompt cell."""
    nb = json.loads(NOTEBOOK.read_text(encoding="utf-8"))
    cell = next("".join(c["source"]) for c in nb["cells"]
                if c["cell_type"] == "code"
                and "DEFINITIONS =" in "".join(c["source"]))
    ns = {"FEELINGS": feelings, "json": json, "re": re}
    exec(cell.split("def label_one")[0], ns)
    return ns["SYSTEM"], ns["build_messages"]


def load_reviews():
    """Ids and text only. The labels never leave this function."""
    with open(TRAIN / "answer_key.jsonl", encoding="utf-8") as fh:
        return [{"id": r["id"], "text": r["text"]}
                for r in map(json.loads, fh)]


def parse(raw, feelings):
    """(valid feelings, invented words) from a reply. Raises if not JSON."""
    found = json.loads(re.search(r"\{.*\}", raw, re.S).group(0))["feelings"]
    return ([f for f in found if f in feelings],
            [f for f in found if f not in feelings])


def cost(usage):
    """Dollars for one reply's usage block. Reasoning is billed as output."""
    cached = (usage.get("prompt_tokens_details") or {}).get("cached_tokens", 0)
    return ((usage["prompt_tokens"] - cached) * PRICE_INPUT
            + cached * PRICE_CACHED
            + usage["completion_tokens"] * PRICE_OUTPUT) / 1e6


class Fatal(Exception):
    """Retrying cannot help: bad key, unknown model, rejected parameter."""


def call(key, messages):
    """One reply's JSON, after retries. Raises on failure."""
    body = {"model": MODEL, "messages": messages,
            "max_completion_tokens": MAX_TOKENS}
    err = None
    for attempt in range(TRIES):
        try:
            r = requests.post(URL, json=body, timeout=300,
                              headers={"Authorization": f"Bearer {key}"})
        except requests.RequestException as e:
            err = type(e).__name__
        else:
            if r.status_code < 400:
                return r.json()
            message = r.json().get("error", {}).get("message", "")[:200]
            if r.status_code in (400, 401, 403, 404):
                raise Fatal(f"HTTP {r.status_code}: {message}")
            err = f"HTTP {r.status_code}: {message}"
        time.sleep(2 ** attempt)
    raise RuntimeError(err)


def label_one(key, rid, text, build_messages, feelings):
    """A saved-reply row for one review. Raises unless the reply is usable."""
    reply = call(key, build_messages(text))
    choice = reply["choices"][0]
    content = choice["message"].get("content") or ""
    parse(content, feelings)        # an unusable reply must not be saved
    return {"id": rid, "content": content, "model": reply.get("model"),
            "usage": reply["usage"]}, cost(reply["usage"])


def read_raw():
    if not RAW.exists():
        return {}
    with open(RAW, encoding="utf-8") as fh:
        return {r["id"]: r for r in map(json.loads, fh)}


def estimate(reviews, build_messages):
    # About 4 characters per token, the same rule of thumb as the notebook.
    tokens = sum(len(json.dumps(build_messages(r["text"]))) for r in reviews) // 4
    print(f"{len(reviews)} reviews, about {tokens:,} input tokens "
          f"(about ${tokens * PRICE_INPUT / 1e6:.2f}).")
    for each in (200, 1000, 2500):
        out = each * len(reviews) * PRICE_OUTPUT / 1e6
        print(f"  at {each:>5,} output tokens per reply, including reasoning: "
              f"${out:.2f} output, ${out + tokens * PRICE_INPUT / 1e6:.2f} total")
    print(f"The run stops itself at ${MAX_COST:.2f}. --test measures the real "
          f"output size for one call.")


def run(key, reviews, build_messages, feelings):
    done = read_raw()
    todo = [r for r in reviews if r["id"] not in done]
    spent = sum(cost(r["usage"]) for r in done.values())
    print(f"{len(done)} already saved (${spent:.2f}), {len(todo)} to go, "
          f"model {MODEL}")

    RAW.parent.mkdir(parents=True, exist_ok=True)
    lock = threading.Lock()
    failed, fatal = [], []

    def work(r):
        nonlocal spent
        with lock:
            if fatal or spent >= MAX_COST:
                return
        try:
            row, dollars = label_one(key, r["id"], r["text"],
                                     build_messages, feelings)
        except Fatal as e:
            with lock:
                fatal.append(str(e))
            return
        except Exception as e:
            with lock:
                failed.append((r["id"], str(e)[:120]))
            return
        with lock:
            spent += dollars
            with open(RAW, "a", encoding="utf-8") as fh:
                fh.write(json.dumps(row) + "\n")
            n = len(read_raw())
            if n % 20 == 0 or n == len(reviews):
                print(f"  {n}/{len(reviews)} saved, ${spent:.2f} so far")

    with cf.ThreadPoolExecutor(WORKERS) as pool:
        list(pool.map(work, todo))

    if fatal:
        sys.exit(f"Stopped: {fatal[0]}")
    if spent >= MAX_COST:
        print(f"Stopped at the ${MAX_COST:.2f} limit. Replies so far are saved.")
    for rid, why in failed[:5]:
        print(f"  failed {rid}: {why}")
    return spent


def write_results(reviews, feelings, system, spent):
    """Everything or nothing. A missing review written as all zeros would score
    as if the LLM had looked and found no feelings."""
    done = read_raw()
    missing = [r["id"] for r in reviews if r["id"] not in done]
    if missing:
        sys.exit(f"{len(missing)} of {len(reviews)} reviews have no reply yet, "
                 f"so no results were written. Run --run again: it continues "
                 f"from the saved replies and retries only these.")

    invented = {}
    PREDS.parent.mkdir(parents=True, exist_ok=True)
    with open(PREDS, "w", encoding="utf-8") as fh:
        for r in reviews:
            found, extra = parse(done[r["id"]]["content"], feelings)
            for word in extra:
                invented[word] = invented.get(word, 0) + 1
            fh.write(json.dumps({
                "id": r["id"],
                "scores": [1 if f in found else 0 for f in feelings]}) + "\n")
    THRESHOLDS.write_text(json.dumps({f: 0.5 for f in feelings}, indent=2) + "\n",
                          encoding="utf-8")

    usage = [r["usage"] for r in done.values()]
    RUN_RECORD.write_text(json.dumps({
        "model_requested": MODEL,
        "models_returned": sorted({r.get("model") or "" for r in done.values()}),
        "settings": {"reasoning": "default", "temperature": "not sent",
                     "max_completion_tokens": MAX_TOKENS},
        "prompt_source": "notebooks/scenehawk_llm_labeling.ipynb",
        "prompt_sha256": hashlib.sha256(system.encode("utf-8")).hexdigest(),
        "reviews": len(reviews),
        "input_tokens": sum(u["prompt_tokens"] for u in usage),
        "output_tokens": sum(u["completion_tokens"] for u in usage),
        "cost_usd": round(spent, 2),
        "invented_words_dropped": invented,
    }, indent=2) + "\n", encoding="utf-8")

    print(f"\nwrote {PREDS.relative_to(ROOT)}, {THRESHOLDS.relative_to(ROOT)}, "
          f"{RUN_RECORD.relative_to(ROOT)}. Total ${spent:.2f}.")
    if invented:
        print(f"dropped words outside the 28 feelings: {invented}")
    print("\nNext:")
    print(f"  python eval/score.py {PREDS.relative_to(ROOT).as_posix()} "
          f"--thresholds {THRESHOLDS.relative_to(ROOT).as_posix()}")
    print(f"  python eval/compare.py {NAME} distilroberta")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--run", action="store_true", help="the real, paid run")
    ap.add_argument("--test", action="store_true",
                    help="one paid call on a made-up review, to measure size")
    args = ap.parse_args()

    meta = json.loads((TRAIN / "meta.json").read_text(encoding="utf-8"))
    feelings = meta["feelings"]
    system, build_messages = load_prompt(feelings)
    reviews = load_reviews()
    expected = meta["splits"]["answer_key"]["rows"]
    if len(reviews) != expected:
        sys.exit(f"answer_key.jsonl has {len(reviews)} rows, meta.json says "
                 f"{expected}.")

    if not args.run and not args.test:
        estimate(reviews, build_messages)
        return

    key = os.environ.get("OPENAI_API_KEY")
    if not key:
        sys.exit("OPENAI_API_KEY is not set (put it in chatbot/.env).")

    try:
        if args.test:
            reply = call(key, build_messages(
                "A really tense thriller. I was gripping my seat, and the ending "
                "made me laugh out loud."))
            usage = reply["usage"]
            print("model:", reply.get("model"))
            print("reply:", reply["choices"][0]["message"].get("content"))
            print("parsed:", parse(reply["choices"][0]["message"]["content"],
                                   feelings)[0])
            print(f"output tokens: {usage['completion_tokens']}, cost "
                  f"${cost(usage):.4f}. Times {len(reviews)} reviews: about "
                  f"${cost(usage) * len(reviews):.2f}")
            return
    except Fatal as e:
        sys.exit(f"Stopped: {e}")

    spent = run(key, reviews, build_messages, feelings)
    write_results(reviews, feelings, system, spent)


if __name__ == "__main__":
    main()
