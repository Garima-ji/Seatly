import os
import sys
import urllib.request
import urllib.error
import subprocess
import threading

EXPRESS_URL = "http://127.0.0.1:4000"

# 1. Monkeypatch fastapi.FastAPI.__init__ to inject reverse proxy middleware dynamically
import fastapi
from fastapi import Request
from fastapi.responses import Response

original_init = fastapi.FastAPI.__init__

def custom_init(self, *args, **kwargs):
    original_init(self, *args, **kwargs)
    
    # Inject our reverse proxy middleware into the FastAPI instance
    @self.middleware("http")
    async def reverse_proxy_middleware(request: Request, call_next):
        path = request.url.path
        if path.startswith("/api/") or path.startswith("/auth/") or path.startswith("/socket.io/"):
            method = request.method
            headers = dict(request.headers)
            headers.pop("host", None)
            headers.pop("connection", None)  # Prevent keep-alive issues in urllib
            
            query_string = request.url.query
            url = f"{EXPRESS_URL}{path}"
            if query_string:
                url += f"?{query_string}"
                
            body = await request.body()
            
            req = urllib.request.Request(
                url,
                data=body if body else None,
                headers=headers,
                method=method
            )
            
            try:
                with urllib.request.urlopen(req, timeout=60.0) as res:
                    res_body = res.read()
                    res_headers = dict(res.headers)
                    return Response(
                        content=res_body,
                        status_code=res.status,
                        headers=res_headers
                    )
            except urllib.error.HTTPError as e:
                # Pass non-2xx status codes (400, 401, 403, etc.) directly to the client
                res_body = e.read()
                res_headers = dict(e.headers)
                return Response(
                    content=res_body,
                    status_code=e.code,
                    headers=res_headers
                )
            except Exception as e:
                return Response(
                    content=f"Proxy error: {str(e)}",
                    status_code=502
                )
                
        # Forward normal traffic (Gradio pages, static UI files)
        return await call_next(request)

fastapi.FastAPI.__init__ = custom_init

# 2. Import Gradio and Spaces after monkeypatching FastAPI
import gradio as gr
import spaces

# ZeroGPU compiler hook
@spaces.GPU
def dummy_gpu_function():
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

# Build Gradio UI blocks interface
with gr.Blocks() as demo:
    gr.Markdown("# 🎟️ Seatly API Backend (ZeroGPU Proxy Gateway)")
    gr.Markdown("The Seatly Express backend is running in the background and served via this proxy.")

print("--> Launching Gradio Proxy Gateway...", flush=True)
demo.launch()
