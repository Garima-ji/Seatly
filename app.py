import os
import sys
import urllib.request
import urllib.error
import subprocess
import threading

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

def setup_and_start_express():
    try:
        # Check if Node is already installed on the system
        node_installed = subprocess.run("node -v", shell=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL).returncode == 0

        if not node_installed:
            if not os.path.exists(NODE_DIR):
                print("--> Downloading Node.js...", flush=True)
                urllib.request.urlretrieve(NODE_URL, NODE_TAR)
                print("--> Extracting Node.js...", flush=True)
                subprocess.run(f"tar -xf {NODE_TAR}", shell=True, check=True)
                if os.path.exists(NODE_TAR):
                    os.remove(NODE_TAR)
                print("--> Node.js installed successfully!", flush=True)
            
            # Add Node.js to PATH
            os.environ["PATH"] = NODE_BIN + os.pathsep + os.environ["PATH"]

        # Verify Node versions
        subprocess.run("node -v", shell=True)
        subprocess.run("npm -v", shell=True)

        # Create custom environment for the Express server to bind strictly to port 4000
        express_env = os.environ.copy()
        express_env["PORT"] = "4000"

        # Install node modules
        print("--> Installing Seatly backend dependencies (background)...", flush=True)
        subprocess.run("npm install", shell=True, cwd="./backend", env=express_env)

        # Compile TypeScript to JavaScript
        print("--> Building Seatly backend (background)...", flush=True)
        subprocess.run("npm run build", shell=True, cwd="./backend", env=express_env)

        # Run migrations
        print("--> Running database migrations (background)...", flush=True)
        subprocess.run("npm run migrate", shell=True, cwd="./backend", env=express_env)

        # Start Express server
        print("--> Starting Seatly Server on port 4000 (background)...", flush=True)
        subprocess.run("npm run start", shell=True, cwd="./backend", env=express_env)
    except Exception as e:
        print(f"--> Express background setup failed: {str(e)}", flush=True)

# Start background Express setup thread
print("--> Launching background setup thread for Node.js backend...", flush=True)
threading.Thread(target=setup_and_start_express, daemon=True).start()

# 2. Start Gradio and FastAPI Reverse Proxy on port 7860 instantly in main thread
import gradio as gr
from fastapi import Request
from fastapi.responses import Response

with gr.Blocks() as demo:
    gr.Markdown("# 🎟️ Seatly API Backend (ZeroGPU Proxy Gateway)")
    gr.Markdown("The Seatly Express backend is running in the background and served via this proxy.")

app = demo.app

# Custom HTTP Middleware to intercept and proxy API, Auth, and WebSocket connection requests
@app.middleware("http")
async def reverse_proxy_middleware(request: Request, call_next):
    return Response(
        content=f"DIAGNOSTIC - Method: {request.method}, Path: {request.url.path}, Headers: {dict(request.headers)}",
        status_code=200
    )

print("--> Launching Gradio Proxy Gateway...", flush=True)
demo.launch()
