import os
import sys
import urllib.request
import subprocess

# 1. Bypass Hugging Face ZeroGPU startup requirement
try:
    import spaces
    @spaces.GPU
    def dummy_gpu_function():
        pass
except Exception:
    pass

# Define Node.js version and paths
NODE_VERSION = "v20.11.0"
NODE_TAR = f"node-{NODE_VERSION}-linux-x64.tar.xz"
NODE_URL = f"https://nodejs.org/dist/{NODE_VERSION}/{NODE_TAR}"
NODE_DIR = os.path.join(os.getcwd(), f"node-{NODE_VERSION}-linux-x64")
NODE_BIN = os.path.join(NODE_DIR, "bin")

# Check if Node is already installed on the system
node_installed = subprocess.run("node -v", shell=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL).returncode == 0

if not node_installed:
    if not os.path.exists(NODE_DIR):
        print(f"--> Downloading Node.js {NODE_VERSION}...", flush=True)
        urllib.request.urlretrieve(NODE_URL, NODE_TAR)
        print("--> Extracting Node.js...", flush=True)
        subprocess.run(f"tar -xf {NODE_TAR}", shell=True, check=True)
        if os.path.exists(NODE_TAR):
            os.remove(NODE_TAR)
        print("--> Node.js installed successfully!", flush=True)
    
    # Add Node.js to PATH
    os.environ["PATH"] = NODE_BIN + os.pathsep + os.environ["PATH"]

# Double check if node and npm are accessible now
subprocess.run("node -v", shell=True)
subprocess.run("npm -v", shell=True)

# 3. Install backend node modules
print("--> Installing Seatly backend dependencies...", flush=True)
subprocess.run("npm install", shell=True, cwd="./backend")

# 4. Compile TypeScript to JavaScript
print("--> Building Seatly backend...", flush=True)
subprocess.run("npm run build", shell=True, cwd="./backend")

# 5. Set Express port to 4000 (Internal)
os.environ["PORT"] = "4000"

# 6. Run migrations
print("--> Running database migrations...", flush=True)
subprocess.run("npm run migrate", shell=True, cwd="./backend")

# 7. Start the Express server in the background
print("--> Starting Seatly Server on port 4000 in the background...", flush=True)
express_proc = subprocess.Popen("npm run start", shell=True, cwd="./backend")

# 8. Start Gradio and FastAPI Reverse Proxy on port 7860
import gradio as gr
from fastapi import Request
from fastapi.responses import Response
import httpx

EXPRESS_URL = "http://127.0.0.1:4000"

with gr.Blocks() as demo:
    gr.Markdown("# 🎟️ Seatly API Backend (ZeroGPU Proxy Gateway)")
    gr.Markdown("The Seatly Express backend is running in the background and served via this proxy.")

app = demo.app

@app.api_route("/api/{path:path}", methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"])
async def proxy_api(request: Request, path: str):
    async with httpx.AsyncClient() as client:
        method = request.method
        headers = dict(request.headers)
        headers.pop("host", None)
        params = dict(request.query_params)
        body = await request.body()
        
        try:
            res = await client.request(
                method,
                f"{EXPRESS_URL}/api/{path}",
                headers=headers,
                params=params,
                content=body,
                timeout=60.0
            )
            return Response(
                content=res.content,
                status_code=res.status_code,
                headers=dict(res.headers)
            )
        except Exception as e:
            return Response(content=f"Proxy error: {str(e)}", status_code=502)

@app.api_route("/auth/{path:path}", methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"])
async def proxy_auth(request: Request, path: str):
    async with httpx.AsyncClient() as client:
        method = request.method
        headers = dict(request.headers)
        headers.pop("host", None)
        params = dict(request.query_params)
        body = await request.body()
        
        try:
            res = await client.request(
                method,
                f"{EXPRESS_URL}/auth/{path}",
                headers=headers,
                params=params,
                content=body,
                timeout=60.0
            )
            return Response(
                content=res.content,
                status_code=res.status_code,
                headers=dict(res.headers)
            )
        except Exception as e:
            return Response(content=f"Proxy error: {str(e)}", status_code=502)

@app.api_route("/socket.io/{path:path}", methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"])
async def proxy_socket(request: Request, path: str):
    async with httpx.AsyncClient() as client:
        method = request.method
        headers = dict(request.headers)
        headers.pop("host", None)
        params = dict(request.query_params)
        body = await request.body()
        
        try:
            res = await client.request(
                method,
                f"{EXPRESS_URL}/socket.io/{path}",
                headers=headers,
                params=params,
                content=body,
                timeout=60.0
            )
            return Response(
                content=res.content,
                status_code=res.status_code,
                headers=dict(res.headers)
            )
        except Exception as e:
            return Response(content=f"Proxy error: {str(e)}", status_code=502)

print("--> Launching Gradio Proxy Gateway on port 7860...", flush=True)
demo.launch(server_name="0.0.0.0", server_port=7860)
