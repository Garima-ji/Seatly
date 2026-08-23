import os
import sys
import urllib.request
import subprocess

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

# 1. Install backend node modules
print("--> Installing Seatly backend dependencies...", flush=True)
subprocess.run("npm install", shell=True, cwd="./backend")

# 2. Compile TypeScript to JavaScript
print("--> Building Seatly backend...", flush=True)
subprocess.run("npm run build", shell=True, cwd="./backend")

# 3. Force the port to 7860 (Hugging Face default)
os.environ["PORT"] = "7860"

# 4. Run migrations
print("--> Running database migrations...", flush=True)
subprocess.run("npm run migrate", shell=True, cwd="./backend")

# 5. Start the Express server
print("--> Starting Seatly Server on port 7860...", flush=True)
sys.exit(
    subprocess.run("npm run start", shell=True, cwd="./backend").returncode
)
