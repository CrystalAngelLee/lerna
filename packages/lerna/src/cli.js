#!/usr/bin/env node

/* eslint-disable */

"use strict";

const importLocal = require("import-local");

// CR-NOTE: `本地node_modules`存在一个脚手架命令，同时`全局node_modules`中也存在这个脚手架命令的时候，优先选用**`本地node_modules`**中的版本，否则选用`全局node_modules`
if (importLocal(__filename)) {
  require("npmlog").info("cli", "using local version of lerna");
} else {
  // CR-NOTE: require(".") => require("./index.js")
  require(".")(process.argv.slice(2));
}
