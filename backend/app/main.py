from fastapi import FastAPI

app = FastAPI(
    title="AEGIS X",
    description="Universal Security Intelligence & Defense Platform",
    version="0.1.0",
)


@app.get("/")
def root():
    return {
        "name": "AEGIS X",
        "version": "0.1.0",
        "status": "operational",
        "message": "AEGIS X security platform is running.",
    }


@app.get("/health")
def health():
    return {
        "status": "healthy",
    }