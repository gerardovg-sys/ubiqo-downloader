import json
import urllib.request
import os

clasprc_path = r'C:\Users\MARCO\.clasprc.json'
file_id = '1RU4tfV0Nn_w1YeUasq-iOwLo3Ms54tO3'
output_path = r'c:\Users\MARCO\Desktop\HOLDING_IA\BITACORA_SMARTCORP\scratch\sample.xlsx'

def get_access_token():
    with open(clasprc_path, 'r', encoding='utf-8') as f:
        creds = json.load(f)
    return creds['tokens']['default']['access_token']

def download_file(token):
    url = f'https://www.googleapis.com/drive/v3/files/{file_id}?alt=media'
    req = urllib.request.Request(url)
    req.add_header('Authorization', f'Bearer {token}')
    
    print(f"Downloading file {file_id} from Drive...")
    with urllib.request.urlopen(req) as response:
        with open(output_path, 'wb') as out_file:
            out_file.write(response.read())
    print(f"File downloaded successfully to {output_path} (size: {os.path.getsize(output_path)} bytes)")

if __name__ == '__main__':
    try:
        token = get_access_token()
        download_file(token)
    except Exception as e:
        print("Error:", e)
