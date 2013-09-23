REPORTER?=dot
ifdef V
	REPORTER=spec
endif

ifdef TEST
	T=--grep '${TEST}'
	REPORTER=list
endif

test: check-deps
	@./node_modules/.bin/_mocha \
		--reporter ${REPORTER} \
		-s 200 \
		-t 20000 $T \
		test/*

check: test

lint: check-deps
	@./node_modules/.bin/jshint -c ./.jshintrc lib test

dependencies:
	@npm install -s
	@npm prune -s

deps: dependencies

update: dependencies

# Note: we install twice so that the second pass installs from cache and the
# shrinkwrap diff isn't polluted with a whole lot of "resolved" urls
update-deps:
	@rm -rf npm-shrinkwrap.json node_modules
	@npm install -s --no-optional || exit 1
	@rm -rf node_modules
	@npm install -s --no-optional || exit 1
	@npm dedupe -s --no-optional || exit 1
	@npm shrinkwrap -s

dev: check-deps
	@V=1 ./node_modules/.bin/supervisor -q \
		--ignore `find . -maxdepth 3 -name .git -or -name node_modules -or -name compiled | \
			tr '\n' , | sed "s/,$$//"` \
		app.js

check-deps:
	@if test ! -d node_modules; then \
		echo "Installing npm dependencies.."; \
		npm install -d; \
	fi

coverage:
	@./node_modules/.bin/istanbul cover \
		./node_modules/.bin/_mocha -- -R spec

coverage-html: coverage
	@open coverage/lcov-report/index.html

clean:
	@rm -rf coverage

sync: check-deps
	@bin/manage sync

.PHONY: dependencies dev test lint coverage coverage-html sync
