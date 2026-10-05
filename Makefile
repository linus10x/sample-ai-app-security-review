# Cedar Supply Portal: one-command targets. Needs Docker, Node 22, make and git.
SHELL := /bin/bash
export PATH := $(PWD)/node_modules/.bin:$(PATH)
PY ?= $(if $(wildcard .venv-tools/bin/python),.venv-tools/bin/python,python3)

.PHONY: help up down demo test unit pgtap exploits e2e scan audit images pdf clean-v0

help:
	@echo "make demo    start everything and open the app and the report"
	@echo "make test    typecheck, lint, unit tests with coverage, pgTAP, exploit suite, smoke test"
	@echo "make audit   scanners, both exploit suites, and the rendered report"
	@echo "make images  render the three portfolio images"
	@echo "make pdf     build the one-page case study"

up:
	npm ci --no-audit --no-fund
	supabase start
	./scripts/local-env.sh
	docker compose up -d stripe-mock
	npm run seed

down:
	supabase stop
	docker compose down

demo: up
	npm run build
	@(set -a; . ./.env; set +a; npx next start -p 3000 > /tmp/cedar-demo.log 2>&1 &)
	@sleep 4
	@$(PY) scripts/render-report.py || true
	@open http://localhost:3000 2>/dev/null || true
	@open docs/findings/REPORT.html 2>/dev/null || true
	@echo "Sign in as admin.harbor@example.com with password demo-password-1"

unit:
	npm run typecheck
	npm run lint
	npm run test:coverage

pgtap:
	supabase test db

exploits:
	./scripts/exploit-job.sh . pass main

e2e:
	@set -a; . ./.env; set +a; npm run build >/dev/null; (npx next start -p 3000 >/tmp/cedar-e2e.log 2>&1 & echo $$! >/tmp/cedar-app.pid); sleep 4; npx playwright test; r=$$?; kill $$(cat /tmp/cedar-app.pid); exit $$r

test: unit pgtap exploits e2e

scan:
	$(PY) -m semgrep scan --config p/typescript --config p/nextjs --config semgrep/cedar.yml --exclude node_modules --exclude .next --metrics=off --quiet --severity ERROR --error
	gitleaks detect --no-banner --redact --log-opts="--all"
	mkdir -p docs/findings
	docker run --rm -v "$(PWD)":/src ghcr.io/google/osv-scanner:latest scan source -L /src/package-lock.json --format json > docs/findings/osv-report.json
	$(PY) scripts/osv-gate.py docs/findings/osv-report.json

# v0-as-shipped is checked out beside the repo, run, and removed.
clean-v0:
	-git worktree remove --force .audit/v0

audit: scan clean-v0
	mkdir -p .audit && git worktree add .audit/v0 v0-as-shipped
	./scripts/exploit-job.sh .audit/v0 fail v0
	$(MAKE) clean-v0
	./scripts/exploit-job.sh . pass main
	$(PY) scripts/render-report.py

images:
	$(PY) scripts/make-images.py

pdf:
	$(PY) scripts/make-pdf.py
