import json
import os

import requests

# Preferred: set WAVE_API_KEY in your terminal.
# Fallback: the key below (provided by user) is used if env var is missing.
API_KEY = os.getenv("WAVE_API_KEY", "UKVNdWh86497")
TARGET_URL = (
    "https://uqshop.com.au/?srsltid=AfmBOoreuIpbfdBRPBfIYU63t75WJMwvo8RVkNDOqg6POb4-YahIW23P"
)

ENDPOINT = "https://wave.webaim.org/api/request"
PARAMS = {
    "key": API_KEY,
    "url": TARGET_URL,
    "format": "json",
    "reporttype": 2,
}


def main() -> None:
    if not API_KEY:
        raise RuntimeError("WAVE API key is missing. Set WAVE_API_KEY first.")

    response = requests.get(ENDPOINT, params=PARAMS, timeout=60)
    response.raise_for_status()
    data = response.json()

    status = data.get("status", {})
    if not status.get("success", False):
        print("WAVE API request failed:")
        print(json.dumps(data, ensure_ascii=False, indent=2))
        raise SystemExit(1)

    stats = data.get("statistics", {})
    print("WAVE check complete")
    print("Page title      :", stats.get("pagetitle"))
    print("Final page URL  :", stats.get("pageurl"))
    print("Total item count:", stats.get("allitemcount"))
    print("Credits remaining:", stats.get("creditsremaining"))

    print("\nCategory counts:")
    for name, detail in data.get("categories", {}).items():
        print(f"- {name}: {detail.get('count', 0)}")

    output_path = os.path.join(os.path.dirname(__file__), "wave_result.json")
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

    print(f"\nFull JSON saved to: {output_path}")


if __name__ == "__main__":
    main()
