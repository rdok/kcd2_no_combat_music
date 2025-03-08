check: test prettier

test:
	docker compose run --rm test_runner

test-watch:
	docker compose run --rm test_watcher

dev:
	bash scripts/build-deploy-start.sh
dev-random-version:
	bash scripts/build-deploy-start.sh random

prod:
	bash scripts/build-prod.sh main

prettier:
	docker compose run --rm ci-cd npm run prettier

prettier-fix:
	docker compose run --rm ci-cd npm run prettier:fix

docs:
	docker compose run --rm ci-cd npm run generate_readme
