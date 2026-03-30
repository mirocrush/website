import requests

SERVER = "http://172.16.98.4:5000"

def check_server() -> bool:
    try:
        r = requests.get(f"{SERVER}/status", timeout=3)
        return r.status_code == 200
    except requests.ConnectionError:
        return False

def upload_file(local_path: str) -> None:
    if not check_server():
        print("Server is not reachable.")
        return

    with open(local_path, "rb") as f:
        response = requests.post(f"{SERVER}/upload", files={"file": f})

    data = response.json()

    if response.status_code == 200:
        print(f"Uploaded successfully.")
        print(f"  Filename : {data['filename']}")
        print(f"  Saved at : {data['path']}")
    else:
        print(f"Upload failed: {data['error']}")

upload_file("app.py")