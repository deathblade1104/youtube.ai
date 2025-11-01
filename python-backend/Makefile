.PHONY: install run run-all worker kafka-worker create-topics test clean format lint

install:
	pip install -r requirements.txt

create-topics:
	python scripts/create_kafka_topics.py

run:
	python run.py

run-all:
	python run_all.py

worker:
	celery -A celery_app worker --loglevel=info --concurrency=2

kafka-worker:
	python kafka_worker.py

test:
	pytest

format:
	black .
	isort .

lint:
	flake8 .
	mypy .

clean:
	find . -type d -name __pycache__ -exec rm -r {} +
	find . -type f -name "*.pyc" -delete
	find . -type f -name "*.pyo" -delete
	find . -type f -name ".coverage" -delete
	rm -rf dist/ build/ *.egg-info

