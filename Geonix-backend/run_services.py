import sys
import subprocess
import os
import argparse
import time

def run_gateway():
    print("Starting Geonix Unified Backend Gateway on port 8000...")
    # Run: uvicorn main:app --reload --host 0.0.0.0 --port 8000
    cmd = [sys.executable, "-m", "uvicorn", "main:app", "--reload", "--host", "0.0.0.0", "--port", "8000"]
    try:
        subprocess.run(cmd)
    except KeyboardInterrupt:
        print("\nGateway stopped.")

def run_separate():
    print("Starting all Geonix backend components on separate ports...")
    processes = []
    
    # 1. Dengue on 8000
    print("- Dengue Warning Service on port 8000")
    p_dengue = subprocess.Popen(
        [sys.executable, "-m", "uvicorn", "api.main:app", "--host", "0.0.0.0", "--port", "8000"],
        cwd=os.path.join(os.path.dirname(__file__), "dengue-warning")
    )
    processes.append(p_dengue)
    
    # 2. Flood Map on 8001
    print("- Flood Map Service on port 8001")
    p_flood = subprocess.Popen(
        [sys.executable, "-m", "uvicorn", "app:app", "--host", "0.0.0.0", "--port", "8001"],
        cwd=os.path.join(os.path.dirname(__file__), "flood-map")
    )
    processes.append(p_flood)
    
    # 3. Paddy Advisory on 8002
    print("- Paddy Advisory Service on port 8002")
    p_paddy = subprocess.Popen(
        [sys.executable, "-m", "uvicorn", "app:app", "--host", "0.0.0.0", "--port", "8002"],
        cwd=os.path.join(os.path.dirname(__file__), "paddy-advisory")
    )
    processes.append(p_paddy)
    
    # 4. Safe Route on 8003
    print("- Safe Route Service on port 8003")
    p_safe = subprocess.Popen(
        [sys.executable, "-m", "uvicorn", "app:app", "--host", "0.0.0.0", "--port", "8003"],
        cwd=os.path.join(os.path.dirname(__file__), "safe_route")
    )
    processes.append(p_safe)
    
    print("\nAll services started! Press Ctrl+C to terminate.")
    try:
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        print("\nStopping all services...")
        for p in processes:
            p.terminate()
        for p in processes:
            p.wait()
        print("All services stopped.")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Run Geonix Backend Services")
    parser.add_argument(
        "--mode",
        choices=["gateway", "separate"],
        default="gateway",
        help="Run mode: 'gateway' (unified on port 8000) or 'separate' (4 standalone services on ports 8000-8003)"
    )
    args = parser.parse_args()
    
    # Add root dir to sys.path so modules can load
    sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
    
    if args.mode == "separate":
        run_separate()
    else:
        run_gateway()
