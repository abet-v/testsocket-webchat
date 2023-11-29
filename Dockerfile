ARG PYTHON_VERSION=3.11-slim-buster

FROM python:${PYTHON_VERSION}

ENV PYTHONDONTWRITEBYTECODE 1
ENV PYTHONUNBUFFERED 1

RUN mkdir -p /code

WORKDIR /code

COPY requirements.txt /tmp/requirements.txt
RUN set -ex && \
    pip install --upgrade pip && \
    pip install -r /tmp/requirements.txt && \
    python -m pip install Django && \
    pip install gunicorn && \
    pip install daphne && \
    pip install channels && \
    rm -rf /root/.cache/
COPY . /code

EXPOSE 8000

CMD ["python3", "manage.py", "runserver", "0.0.0.0:8000"]