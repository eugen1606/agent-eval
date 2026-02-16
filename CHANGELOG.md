# Changelog

## [2.0.0](https://github.com/eugen1606/agent-eval/compare/v1.1.0...v2.0.0) (2026-02-16)


### ⚠ BREAKING CHANGES

* add conversation-like test, with defined goals, scenarios and personas

### Features

* add conversation-like test, with defined goals, scenarios and personas ([422cd7b](https://github.com/eugen1606/agent-eval/commit/422cd7b625da9a29211bb08a94094765b436db0d))
* add Q&A badge and export dropdown to runs list ([a1b480f](https://github.com/eugen1606/agent-eval/commit/a1b480f8167db88a32e2c950655e0584df379874))
* add repeat count for questions in q&a test ([05663be](https://github.com/eugen1606/agent-eval/commit/05663be3121ea559cb92b0f9f6998649daab4bf0))
* refactor charts in q&a type dashboard ([70348f0](https://github.com/eugen1606/agent-eval/commit/70348f0fd2d9aeff6d363feed28c9ef832878afc))
* replace textarea with CodeMirror JSON editor ([9416997](https://github.com/eugen1606/agent-eval/commit/9416997aa964d345336becea8ada684ebeda9b6c))


### Bug Fixes

* auto-correct page when last item is deleted ([3eb3c44](https://github.com/eugen1606/agent-eval/commit/3eb3c44e55061a0398e673f9c57afbaa3d8c5069))
* consistent button layout in scheduled tests ([1f61284](https://github.com/eugen1606/agent-eval/commit/1f61284e08aaa5f82ba8822a5b82c305f1f368cc))
* disable nginx proxy buffering for SSE streaming ([927064e](https://github.com/eugen1606/agent-eval/commit/927064e2bb7d47efe80764592deaeb6c0a9ab512))
* fixed numeric inputs ([467f8cd](https://github.com/eugen1606/agent-eval/commit/467f8cd7b3a07f55da2e5b3696a47d48da020511))
* fixed tag rendering in create/edit test modal ([82c67e2](https://github.com/eugen1606/agent-eval/commit/82c67e20e66653c228354dabc7a0dceb6c56843f))
* live-update Q&A run results and stop conversation page flicker ([a15967b](https://github.com/eugen1606/agent-eval/commit/a15967b790db21e29b2d510148b37475bf016f61))
* proactive token refresh to avoid 401 spam ([cf02426](https://github.com/eugen1606/agent-eval/commit/cf024266fc1533e75b1685d5399e15f562594b45))
* register ScheduleModule.forRoot() only once in AppModule ([28947bc](https://github.com/eugen1606/agent-eval/commit/28947bcd8b8822bc12a8ff847ba5ad98183147ca))
* use SearchableSelect in dashboard dropdowns ([39a37ee](https://github.com/eugen1606/agent-eval/commit/39a37ee7fada65f09d87dd37049771ee3da529c8))


### CI/CD

* fix test ci failing ([2dc071f](https://github.com/eugen1606/agent-eval/commit/2dc071fecea5cc3a09013bf58624f7cf6122c6d0))


### Miscellaneous

* remove duplicate UI components and barrel file ([58ff9d0](https://github.com/eugen1606/agent-eval/commit/58ff9d0cafd3758cce6d70ac3f44e52fa9edfe30))

## [1.1.0](https://github.com/eugen1606/agent-eval/compare/v1.0.0...v1.1.0) (2026-02-12)


### Features

* add option to automatically evaluate run with AI Evaluator ([f313c38](https://github.com/eugen1606/agent-eval/commit/f313c38bce706f76866d3a61956274c211220a04))
* add sessionId in run details for each question ([d291342](https://github.com/eugen1606/agent-eval/commit/d29134224045e29a4455e5556a2375d788ef70e6))


### Bug Fixes

* fixed AI evaluation progress disappearing when leaving run detail page ([ebb9623](https://github.com/eugen1606/agent-eval/commit/ebb96236a60998de4c827d8d2c33c97d32626f23))
* fixed editing tests ([fbf071c](https://github.com/eugen1606/agent-eval/commit/fbf071c56b2b754962ebb2f4ffc76a36915372c7))


### CI/CD

* add Docker image build on release and deploy compose file ([7d56446](https://github.com/eugen1606/agent-eval/commit/7d564469acd060e6244604c4bc3939ab5b950b59))

## [1.0.0](https://github.com/eugen1606/agent-eval/compare/v0.1.0...v1.0.0) (2026-02-11)


### ⚠ BREAKING CHANGES

* add possibility to evaluate runs with ai

### Features

* add pdf and csv exports to runs, and csv export to dashboard ([d038c92](https://github.com/eugen1606/agent-eval/commit/d038c92b96d13fc6a3e96e0d1db6035034afa243))
* add possibility to evaluate runs with ai ([a2eeed7](https://github.com/eugen1606/agent-eval/commit/a2eeed7d385a2eaf31fd3c9bec30eb2337ab3338))
* implement DiffView component and similarity calculation for test results ([2049301](https://github.com/eugen1606/agent-eval/commit/204930160d48aa50c59b02c95fa2e8d18c8d7b10))


### CI/CD

* enable corepack ([e1d7971](https://github.com/eugen1606/agent-eval/commit/e1d79719d197924cc03048da6cdb13e607718d08))
* enable read for nrwl/nx-set-shas ([7c0a74e](https://github.com/eugen1606/agent-eval/commit/7c0a74e08e2165b202fe71ef65598fa5da5708a6))
