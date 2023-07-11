# Lerna Note
> 笔记查询 CR-NOTE

**入口文件路径：** `packages/lerna/src/cli.js`

## yargs 使用解读

```js
const cli = yargs(argv, cwd);

return cli.options(opts) // options: 批量注册选项
  // group: 给options分类
  .group(globalKeys, "Global Options:")
	// option: 单个注册选项
  .option("ci", {
    hidden: true,
    type: "boolean",
  })
	/**
    * 展示用法,当我们使用--help的时候展示，或者使用了strict()时，命令输入错误，展示错误提示的时候展示。
    * 使用$0来标识命令名称，也就是package.json中的bin的属性
    * */
  .usage("Usage: $0 <command> [options]")
  // 设置最少命令个数
  .demandCommand(1, "A command is required. Pass --help to see all available commands and options.")
  // 当用户输错命令的时候，提示近似命令
  .recommendCommands()
  // 启用严格模式，这个代表输入的参数不对的时候，会给我们一个错误提示。如果没有这条，那么输入错误是没有任何反馈的。
  .strict()
  // 输入错误命令的时候进行处理，有了这个后，demandCommand无效,recommendCommands无效，其实就是--help的帮助信息看板无效
  .fail((msg, err: any) => {
    // 处理 msg
  })
  // 别名
  .alias("h", "help")
  .alias("v", "version")
  /**
   * 设置命令提示的宽度
   * 跟控制台同宽：cli.terminalWidth()
   */
  .wrap(cli.terminalWidth())
  // 自定义结尾
  // dedent库-去掉首尾缩进
  .epilogue(dedent`
    When a command fails, all logs are written to lerna-debug.log in the current working directory.

    For more information, check out the docs at https://lerna.js.org/docs/introduction
  `)
  // 命令注册
  .command(addCachingCmd)
```



## import-local 源码解析

> `本地node_modules`存在一个脚手架命令，同时`全局node_modules`中也存在这个脚手架命令的时候，优先选用**`本地node_modules`**中的版本

```js
'use strict';
const path = require('path');
const {fileURLToPath} = require('url');
const resolveCwd = require('resolve-cwd');
const pkgDir = require('pkg-dir');

module.exports = filename => {
	const normalizedFilename = filename.startsWith('file://') ? fileURLToPath(filename) : filename;
  // pkgDir.sync是为了获取 当前参数(地址) 包含package.json的模块目录，也就是会从path.dirname(filename)逐层向上找，直到找到package.json为止所得到的路径。即path.dirname(filename)所在包目录
	const globalDir = pkgDir.sync(path.dirname(normalizedFilename));
  // 找出globalDir与filename的相对路径，也就是以globalDir为参照到filename的路径
	const relativePath = path.relative(globalDir, normalizedFilename);
  // 拿到filename所在包的package.json
	const pkg = require(path.join(globalDir, 'package.json'));
	// !!!核心代码——resolveCwd.silent() 判断当前本地是否有这个文件
	const localFile = resolveCwd.silent(path.join(pkg.name, relativePath));
	const localNodeModules = path.join(process.cwd(), 'node_modules');

	const filenameInLocalNodeModules = !path.relative(localNodeModules, normalizedFilename).startsWith('..') &&
		// On Windows, if `localNodeModules` and `normalizedFilename` are on different partitions, `path.relative()` returns the value of `normalizedFilename`, resulting in `filenameInLocalNodeModules` incorrectly becoming `true`.
		path.parse(localNodeModules).root === path.parse(normalizedFilename).root;

  // 判断本地是否有这个文件，则require()该文件，require就是执行该文件
	return !filenameInLocalNodeModules && localFile && path.relative(localFile, normalizedFilename) !== '' && require(localFile);
};
```



## pkg-dir 源码解析

> 从某个目录开始向上查找，直到找到存在`package.json`的目录，并返回该目录。如果未找到则返回null
