# WAVE API README

This folder contains `wave_check.py`, a script that calls WAVE API to check a web page.

## 1. Install dependency

Run in VSCode terminal (PowerShell):

```powershell
pip install requests
```

## 2. Set `YOUR_API_KEY`

Recommended: use an environment variable (do not hardcode secrets in source code).

Set for current terminal session:

```powershell
$env:WAVE_API_KEY="YOUR_API_KEY"
```

Save permanently for current Windows user:

```powershell
[Environment]::SetEnvironmentVariable("WAVE_API_KEY", "YOUR_API_KEY", "User")
```

If you set it permanently, open a new terminal before running the script.

## 3. Set target URL

Open `wave_check.py` and update:

```python
TARGET_URL = "https://example.com"
```

Replace `https://example.com` with the page you want to test.

## 4. Run the script

From the project root:

```powershell
python .\wave.api\wave_check.py
```

## 5. Output

On success, the script:

1. Prints page title, item counts, category counts, and remaining credits.
2. Saves full response JSON to `wave.api/wave_result.json`.

## Optional: Put key directly in code

If you do not want environment variables, set a fallback key in `wave_check.py`:

```python
API_KEY = os.getenv("WAVE_API_KEY", "YOUR_API_KEY")
```

Do not commit real API keys to Git repositories.
