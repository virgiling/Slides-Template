.DEFAULT_GOAL := help

SHELL := /bin/sh
MANAGER := ./scripts/slides

.PHONY: help doctor list new install build build-template preview watch serve thumbnails clean delete \
	build-all clean-all build-current preview-current serve-current clean-current test

help:
	@$(MANAGER) help

doctor:
	@$(MANAGER) doctor

list:
	@$(MANAGER) list

# TYPE=latex (default) or TYPE=marp selects only the new project's template.
new:
	@$(MANAGER) new

install:
	@$(MANAGER) install

build:
	@$(MANAGER) build

build-template:
	@$(MANAGER) build-template

preview:
	@$(MANAGER) preview

watch:
	@$(MANAGER) watch

serve:
	@$(MANAGER) serve

thumbnails:
	@$(MANAGER) thumbnails

test:
	@PYTHONDONTWRITEBYTECODE=1 python3 -m unittest discover -s tests -v

clean:
	@$(MANAGER) clean

delete:
	@$(MANAGER) delete

build-all:
	@$(MANAGER) build-all

clean-all:
	@$(MANAGER) clean-all

# These targets consume ZED_FILE and ZED_ROW from Zed's task environment.
build-current:
	@$(MANAGER) build-current

preview-current:
	@$(MANAGER) preview-current

serve-current:
	@$(MANAGER) serve-current

clean-current:
	@$(MANAGER) clean-current
