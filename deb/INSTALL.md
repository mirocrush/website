# TalentCodeHub Desktop Client

A Python/tkinter GUI client for TalentCodeHub.

## Prerequisites (Ubuntu)

```bash
sudo apt install python3 python3-tk python3-requests
```

## Build the .deb

```bash
cd deb
bash build.sh
```

## Install

```bash
sudo apt install ./talentcodehub_1.0.0_all.deb
```

Or with dpkg:

```bash
sudo dpkg -i talentcodehub_1.0.0_all.deb
sudo apt-get install -f   # fix any missing deps
```

## Run

After installation:

```bash
talentcodehub
```

Or launch from your applications menu.

## Uninstall

```bash
sudo apt remove talentcodehub
```
