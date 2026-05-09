FROM python:3.12-slim

WORKDIR /app

RUN pip install uv

COPY backend/ /app

RUN uv sync --frozen

EXPOSE 3000

CMD ["sh", "-c", "uv run alembic upgrade head && uv run uvicorn app.main:app --host 0.0.0.0 --port 3000 --workers 2"]
