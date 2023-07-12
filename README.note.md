# Lerna Note
> - 笔记查询 CR-NOTE
>
> - [Require 源码解读](https://www.ruanyifeng.com/blog/2015/05/require.html)

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
  /**
   * 获取全局目录
   * 1. pkgDir: 获取 normalizedFilename 包含 package.json 的上级目录
   * 从 path.dirname(normalizedFilename) 逐层向上找，直到找到 package.json 为止所得到的路径
   * 即 path.dirname(normalizedFilename) 所在包目录
   * 2. path.dirname(normalizedFilename) 查找文件的上级目录
   */
	const globalDir = pkgDir.sync(path.dirname(normalizedFilename));
  // 找出globalDir与filename的相对路径，也就是以globalDir为参照到filename的路径
	const relativePath = path.relative(globalDir, normalizedFilename);
  // 拿到filename所在包的package.json
	const pkg = require(path.join(globalDir, 'package.json'));
	// !!!核心代码——resolveCwd.silent() 判断当前本地当前路径下是否有这个文件
	const localFile = resolveCwd.silent(path.join(pkg.name, relativePath));
	const localNodeModules = path.join(process.cwd(), 'node_modules');

	const filenameInLocalNodeModules = !path.relative(localNodeModules, normalizedFilename).startsWith('..') &&
		// On Windows, if `localNodeModules` and `normalizedFilename` are on different partitions, `path.relative()` returns the value of `normalizedFilename`, resulting in `filenameInLocalNodeModules` incorrectly becoming `true`.
		path.parse(localNodeModules).root === path.parse(normalizedFilename).root;

  // 本地有这个文件，则require()该文件，require就是执行该文件
	return !filenameInLocalNodeModules && localFile && path.relative(localFile, normalizedFilename) !== '' && require(localFile);
};
```



## pkg-dir 源码解析

> 从某个目录开始向上查找，直到找到存在`package.json`的目录，并返回该目录。如果未找到则返回null

```js
'use strict';
const path = require('path');
const findUp = require('find-up');

const pkgDir = async cwd => {
	const filePath = await findUp('package.json', {cwd});
	return filePath && path.dirname(filePath);
};

module.exports = pkgDir;

module.exports.sync = cwd => {
  // 通过当前文件夹路径 cwd 向上查找 package.json
	const filePath = findUp.sync('package.json', {cwd});
	return filePath && path.dirname(filePath);
};
```



## find-up 源码解析

```js
'use strict';
const path = require('path');
const locatePath = require('locate-path');
const pathExists = require('path-exists');

const stop = Symbol('findUp.stop');

...
// 同步调用
module.exports.sync = (name, options = {}) => {
  // path.resolve: 将两个相对路径进行结合
	let directory = path.resolve(options.cwd || '');
  // path.parse: 解析路径
	const {root} = path.parse(directory);
  // name 传递过来的文件名称（要查找的文件名）
	const paths = [].concat(name);

  // locatePath: 在磁盘多个路径中查找第一个存在的路径
	const runMatcher = locateOptions => {
		if (typeof name !== 'function') {
      // 查找当前路径是否存在
			return locatePath.sync(paths, locateOptions);
		}

		const foundPath = name(locateOptions.cwd);
		if (typeof foundPath === 'string') {
			return locatePath.sync([foundPath], locateOptions);
		}

		return foundPath;
	};

	// eslint-disable-next-line no-constant-condition
	while (true) {
		const foundPath = runMatcher({...options, cwd: directory});

		if (foundPath === stop) {
			return;
		}

		if (foundPath) {
      // 返回合并路径
			return path.resolve(directory, foundPath);
		}

		if (directory === root) {
			return;
		}

		directory = path.dirname(directory);
	}
};

module.exports.exists = pathExists;

module.exports.sync.exists = pathExists.sync;

module.exports.stop = stop;
```



## locate-path 源码解析

```js
'use strict';
const path = require('path');
const fs = require('fs');
const {promisify} = require('util');
const pLocate = require('p-locate');

const fsStat = promisify(fs.stat);
const fsLStat = promisify(fs.lstat);

const typeMappings = {
	directory: 'isDirectory',
	file: 'isFile'
};

function checkType({type}) {
	if (type in typeMappings) {
		return;
	}

	throw new Error(`Invalid type specified: ${type}`);
}

const matchType = (type, stat) => type === undefined || stat[typeMappings[type]]();

...

module.exports.sync = (paths, options) => {
	options = {
		cwd: process.cwd(),
		allowSymlinks: true,
		type: 'file',
		...options
	};
	checkType(options);
	const statFn = options.allowSymlinks ? fs.statSync : fs.lstatSync;

	for (const path_ of paths) {
		try {
			const stat = statFn(path.resolve(options.cwd, path_));

			if (matchType(options.type, stat)) {
				return path_;
			}
		} catch (_) {
		}
	}
};
```



## path-exists 源码解析

```js
'use strict';
const fs = require('fs');
const {promisify} = require('util');

const pAccess = promisify(fs.access);

...

module.exports.sync = path => {
	try {
    // 判断当前文件是否存在
		fs.accessSync(path);
		return true;
	} catch (_) {
		return false;
	}
};
```



## resolve-cwd 源码解析

> 主要使用了 `resolve-from` 方法

```js
'use strict';
const resolveFrom = require('resolve-from');

// process.cwd() 返回当前执行路径
module.exports = moduleId => resolveFrom(process.cwd(), moduleId);
module.exports.silent = moduleId => resolveFrom.silent(process.cwd(), moduleId);
```



## resolve-from 源码解析

```js
'use strict';
const path = require('path');
const Module = require('module');
const fs = require('fs');

const resolveFrom = (fromDirectory, moduleId, silent) => {
	if (typeof fromDirectory !== 'string') {
		throw new TypeError(`Expected \`fromDir\` to be of type \`string\`, got \`${typeof fromDirectory}\``);
	}

	if (typeof moduleId !== 'string') {
		throw new TypeError(`Expected \`moduleId\` to be of type \`string\`, got \`${typeof moduleId}\``);
	}

	try {
    // 同步计算给定路径的规范路径名
		fromDirectory = fs.realpathSync(fromDirectory);
	} catch (error) {
		if (error.code === 'ENOENT') {
      // 相对路径 => 绝对路径
			fromDirectory = path.resolve(fromDirectory);
		} else if (silent) {
			return;
		} else {
			throw error;
		}
	}

  // 用当前路径 +  生成文件
	const fromFile = path.join(fromDirectory, 'noop.js');

	const resolveFileName = () => Module._resolveFilename(moduleId, {
		id: fromFile,
		filename: fromFile,
    // 所有可能的 nodemodules 路径
		paths: Module._nodeModulePaths(fromDirectory)
	});

  // 静默情况下如果有异常出现异常不会被抛出
	if (silent) {
		try {
			return resolveFileName();
		} catch (error) {
			return;
		}
	}

	return resolveFileName();
};

module.exports = (fromDirectory, moduleId) => resolveFrom(fromDirectory, moduleId);
module.exports.silent = (fromDirectory, moduleId) => resolveFrom(fromDirectory, moduleId, true);
```

### Module.\_nodeModulePaths 和 Module.\_resolveFilename 的执行流程



