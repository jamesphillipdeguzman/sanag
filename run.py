import os
import sys
import subprocess
import time
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parent
BACKEND_DIR = ROOT_DIR / "backend"
FRONTEND_DIR = ROOT_DIR / "frontend"

def find_python_executable():
    """Detects virtual environment Python or falls back to system interpreter."""
    candidates = [
        ROOT_DIR / ".venv" / "Scripts" / "python.exe",     # Windows root .venv
        BACKEND_DIR / "venv" / "Scripts" / "python.exe",   # Windows backend/venv
        BACKEND_DIR / ".venv" / "Scripts" / "python.exe",  # Windows backend/.venv
        ROOT_DIR / ".venv" / "bin" / "python",             # macOS/Linux root .venv
        BACKEND_DIR / "venv" / "bin" / "python",           # macOS/Linux backend/venv
    ]
    for candidate in candidates:
        if candidate.is_file():
            return str(candidate)
    return sys.executable

def main():
    py_exec = find_python_executable()

    print("=" * 55)
    print("  Starting SANAG Full-Stack Services (Universal Runner) ")
    print("=" * 55)
    print(f"Using Python : {py_exec}")
    print("-> Backend   : http://127.0.0.1:8000 (API Docs: http://127.0.0.1:8000/docs)")
    print("-> Frontend  : http://localhost:5173")
    print("Press Ctrl+C in this terminal to shut down both servers.")
    print("=" * 55 + "\n")

    # 1. Backend Process (FastAPI via Uvicorn)
    backend_cmd = [
        py_exec, "-m", "uvicorn", "main:app",
        "--reload",
        "--host", "127.0.0.1",
        "--port", "8000"
    ]
    backend_proc = subprocess.Popen(backend_cmd, cwd=str(BACKEND_DIR))

    # Give backend a moment to spin up
    time.sleep(1)

    # 2. Frontend Process (Vite dev server)
    frontend_cmd = "npm run dev"
    frontend_proc = subprocess.Popen(frontend_cmd, cwd=str(FRONTEND_DIR), shell=True)

    try:
        while True:
            time.sleep(0.5)
            if backend_proc.poll() is not None or frontend_proc.poll() is not None:
                break
    except KeyboardInterrupt:
        print("\nShutting down SANAG servers...")
    finally:
        for proc in [backend_proc, frontend_proc]:
            if proc.poll() is None:
                proc.terminate()
                try:
                    proc.wait(timeout=2)
                except subprocess.TimeoutExpired:
                    proc.kill()
        print("Both servers stopped cleanly.")

if __name__ == "__main__":
    main()