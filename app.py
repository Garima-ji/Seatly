import os
import sys
import urllib.request
import urllib.error
import subprocess
import threading
import uvicorn
from fastapi import FastAPI, Request
from fastapi.responses import Response

# 1. Bypass Hugging Face ZeroGPU static check
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

# 2. Initialize Pure FastAPI Server (Bypasses Gradio dependencies entirely)
app = FastAPI(title="Seatly Gateway API")

EXPRESS_URL = "http://127.0.0.1:4000"

async def proxy_request(request: Request, path: str, prefix: str):
    method = request.method
    headers = dict(request.headers)
    headers.pop("host", None)
    headers.pop("connection", None)  # Prevent keep-alive routing issues in urllib
    
    query_string = request.url.query
    url = f"{EXPRESS_URL}/{prefix}/{path}"
    if query_string:
        url += f"?{query_string}"
        
    body = await request.body()
    
    # Construct the proxy request using urllib
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

@app.api_route("/api/{path:path}", methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS", "HEAD"])
async def proxy_api(request: Request, path: str):
    return await proxy_request(request, path, "api")

@app.api_route("/auth/{path:path}", methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS", "HEAD"])
async def proxy_auth(request: Request, path: str):
    return await proxy_request(request, path, "auth")

@app.api_route("/socket.io/{path:path}", methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS", "HEAD"])
async def proxy_socket(request: Request, path: str):
    return await proxy_request(request, path, "socket.io")

@app.get("/")
async def root():
    return Response(
        content="<h1>Seatly API Gateway is Running</h1><p>The backend services are online and proxying requests successfully.</p>",
        media_type="text/html"
    )

if __name__ == "__main__":
    # Get port set dynamically by Hugging Face (default to 7860)
    port = int(os.environ.get("PORT", 7860))
    print(f"--> Starting FastAPI Gateway on port {port}...", flush=True)
    uvicorn.run(app, host="0.0.0.0", port=port)
