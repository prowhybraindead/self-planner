import os
from pathlib import Path

from dotenv import load_dotenv
import uvicorn

from main import app


if __name__ == "__main__":
    base_dir = Path(__file__).resolve().parent
    load_dotenv(base_dir / ".env")

    host = os.getenv("HOST", "0.0.0.0")
    port = int(os.getenv("APP_PORT", os.getenv("PORT", "8000")))
    uvicorn.run(app, host=host, port=port)
