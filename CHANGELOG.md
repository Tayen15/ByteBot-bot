# Changelog

All notable changes to this project will be documented in this file. See [commit-and-tag-version](https://github.com/absolute-version/commit-and-tag-version) for commit guidelines.

## [1.7.0](https://github.com/Tayen15/ByteBot-bot/compare/v1.6.4...v1.7.0) (2026-05-17)


### Features

* initialize Prisma schema with MongoDB models for user, guild, and bot functionality ([7b7f30a](https://github.com/Tayen15/ByteBot-bot/commit/7b7f30af790bdce5872de3d58ea8e53998524637))

## [1.6.4](https://github.com/Tayen15/ByteBot-bot/compare/v1.6.3...v1.6.4) (2026-05-17)

## [1.6.3](https://github.com/Tayen15/ByteBot-bot/compare/v1.6.2...v1.6.3) (2026-05-17)

## [1.6.2](https://github.com/Tayen15/ByteBot-bot/compare/v1.6.1...v1.6.2) (2026-05-17)

## [1.6.1](https://github.com/Tayen15/ByteBot-bot/compare/v1.6.0...v1.6.1) (2026-05-17)

## 1.6.0 (2026-05-17)


### Features

* **api:** add health check endpoint for Discord client status ([c9e170f](https://github.com/Tayen15/ByteBot-bot/commit/c9e170f5a4e0c3487ef5555431f209f01f5fda3a))
* implement database layer with Prisma and add authentication middleware ([7224785](https://github.com/Tayen15/ByteBot-bot/commit/7224785867b9ab0b12cda5b4313a99530f694b6e))
* initialize Prisma schema with MongoDB and remove unused web-only configurations ([00abd65](https://github.com/Tayen15/ByteBot-bot/commit/00abd6555a8709904ec60f4ab34eea495c9145f6))
* update dependencies and improve lofi command functionality ([7a86d46](https://github.com/Tayen15/ByteBot-bot/commit/7a86d462d3c26fad8e7cac8f118d9ee2609ad93b))


### Bug Fixes

* **api:** improve owner info fetching and handle rate limits for guild members ([273b9f6](https://github.com/Tayen15/ByteBot-bot/commit/273b9f64954f1a25a11dd97f1becd5d6c9bbacef))
* **api:** remove deprecated command toggles and related features ([fd078bf](https://github.com/Tayen15/ByteBot-bot/commit/fd078bf8eea7710be61d356b162ab28166eadbf2))
* **auth:** reorder exported middleware functions for consistency ([62477f1](https://github.com/Tayen15/ByteBot-bot/commit/62477f18cfb02a705f41c8443507ecc275b245eb))
* **bot:** add missing @discordjs/builders dependency ([05f85ec](https://github.com/Tayen15/ByteBot-bot/commit/05f85ecfe01bb951b56ba860eb7ce1e375ad134a))
* **guildMemberAdd:** handle empty memberCountText for custom welcome images ([7846dff](https://github.com/Tayen15/ByteBot-bot/commit/7846dfff0fd2394651f65e3b72eeba5a848be185))
* **interaction:** remove redundant command enable check for non-owner users ([fdd239a](https://github.com/Tayen15/ByteBot-bot/commit/fdd239a98eb68e0546260f26f81b72b568ea6032))
* **ready:** remove unused command toggles initialization ([3191a4d](https://github.com/Tayen15/ByteBot-bot/commit/3191a4d00efe004d7bcb8209394f78c8790aad45))
* **server:** update default port to 4000 ([4f49613](https://github.com/Tayen15/ByteBot-bot/commit/4f49613e6587100197e25e4c1ffd4627ab0de02d))
