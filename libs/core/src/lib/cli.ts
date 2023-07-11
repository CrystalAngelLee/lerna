import dedent from "dedent";
import log from "npmlog";
import os from "os";
import yargs from "yargs";

/**
 * A factory that returns a yargs() instance configured with everything except commands.
 * Chain .parse() from this method to invoke.
 */
export function lernaCLI(argv?: string | readonly string[], cwd?: string) {
  const cli = yargs(argv, cwd);

  return globalOptions(cli)
    /**
      * CR-NOTE
      * 展示用法,当我们使用--help的时候展示，或者使用了strict()时，命令输入错误，展示错误提示的时候展示。
      * 使用$0来标识命令名称，也就是package.json中的bin的属性
      * */
    .usage("Usage: $0 <command> [options]")
    // CR-NOTE: 设置最少命令个数
    .demandCommand(1, "A command is required. Pass --help to see all available commands and options.")
    // CR-NOTE: 当用户输错命令的时候，提示近似命令
    .recommendCommands()
    // CR-NOTE: 启用严格模式，这个代表输入的参数不对的时候，会给我们一个错误提示。如果没有这条，那么输入错误是没有任何反馈的。
    .strict()
    // CR-NOTE: 输入错误命令的时候进行处理，有了这个后，demandCommand无效,recommendCommands无效，其实就是--help的帮助信息看板无效
    .fail((msg, err: any) => {
      // certain yargs validations throw strings :P
      const actual = err || new Error(msg);

      // ValidationErrors are already logged, as are package errors
      if (actual.name !== "ValidationError" && !actual.pkg) {
        // the recommendCommands() message is too terse
        if (/Did you mean/.test(actual.message)) {
          // TODO: refactor to address type issues
          // eslint-disable-next-line @typescript-eslint/ban-ts-comment
          // @ts-ignore
          log.error("lerna", `Unknown command "${cli.parsed.argv._[0]}"`);
        }

        log.error("lerna", actual.message);
      }

      // exit non-zero so the CLI can be usefully chained
      cli.exit(actual.exitCode > 0 ? actual.exitCode : 1, actual);
    })
    // CR-NOTE: 别名
    .alias("h", "help")
    .alias("v", "version")
    /**
     * CR-NOTE
     * 设置命令提示的宽度
     * 跟控制台同宽：cli.terminalWidth()
     */
    .wrap(cli.terminalWidth())
    // CR-NOTE: 自定义结尾
    // CR-NOTE: dedent库-去掉首尾缩进
    .epilogue(dedent`
      When a command fails, all logs are written to lerna-debug.log in the current working directory.

      For more information, check out the docs at https://lerna.js.org/docs/introduction
    `);
}

function globalOptions(argv: yargs.Argv) {
  // the global options applicable to _every_ command
  const opts: { [key: string]: yargs.Options } = {
    loglevel: {
      defaultDescription: "info",
      describe: "What level of logs to report.",
      type: "string",
    },
    concurrency: {
      defaultDescription: String(os.cpus().length),
      describe: "How many processes to use when lerna parallelizes tasks.",
      type: "number",
      requiresArg: true,
    },
    "reject-cycles": {
      describe: "Fail if a cycle is detected among dependencies.",
      type: "boolean",
    },
    "no-progress": {
      describe: "Disable progress bars. (Always off in CI)",
      type: "boolean",
    },
    progress: {
      // proxy for --no-progress
      hidden: true,
      type: "boolean",
    },
    "no-sort": {
      describe: "Do not sort packages topologically (dependencies before dependents).",
      type: "boolean",
    },
    sort: {
      // proxy for --no-sort
      hidden: true,
      type: "boolean",
    },
    "max-buffer": {
      describe: "Set max-buffer (in bytes) for subcommand execution",
      type: "number",
      requiresArg: true,
    },
    "dist-tag": {
      describe: "Use the specified dist-tag when looking up package versions with `npm view`",
      type: "string",
    },
    registry: {
      describe: "Use the specified registry for looking up package versions with `npm view`",
      type: "string",
    },
  };

  // group options under "Global Options:" header
  const globalKeys = Object.keys(opts).concat(["help", "version"]);

  /**
   * CR-NOTE
   * options: 批量注册选项
   * option: 单个注册选项
   * group: 给options分类
   */
  return argv.options(opts).group(globalKeys, "Global Options:").option("ci", {
    hidden: true,
    type: "boolean",
  });
}
