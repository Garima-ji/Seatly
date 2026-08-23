import subprocess
import os
import sys

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
