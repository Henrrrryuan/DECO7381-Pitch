# Optional WAVE API Experiment

This folder contains an optional script for calling the WAVE API during development. It is not required for the main CogniLens dashboard, History page, Eye Tracking workflow, or final demo path.

If this folder is included in the final codebase, WAVE API should be listed in the third-party sources appendix.

## Files

```text
eye/wave.api/
  wave_check.py       optional WAVE API request script
  wave_result.json    sample saved response, if generated
```

## Install Dependency

The script uses `requests`. Install it separately if it is not already available:

```powershell
python -m pip install requests
```

## Configure API Key

Use an environment variable. Do not hardcode real API keys in source code.

For the current PowerShell session:

```powershell
$env:WAVE_API_KEY="YOUR_API_KEY"
```

For the current Windows user:

```powershell
[Environment]::SetEnvironmentVariable("WAVE_API_KEY", "YOUR_API_KEY", "User")
```

Open a new terminal after setting a persistent user environment variable.

## Configure Target URL

Edit `TARGET_URL` in:

```text
eye/wave.api/wave_check.py
```

## Run

From `Project_14_Six_minus_one/`:

```powershell
python .\eye\wave.api\wave_check.py
```

On success, the script prints summary counts and saves the full JSON response to:

```text
eye/wave.api/wave_result.json
```

## Submission Note

This WAVE API script is experimental support material. If it is not part of the final product workflow, describe it as an optional development comparison tool rather than a core CogniLens feature.
