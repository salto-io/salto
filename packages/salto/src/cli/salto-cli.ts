#!/usr/bin/env node
import { Command } from 'commander'
import Cli from './commands'


class SaltoCommander {
  private command: Command
  private cli: Cli
  constructor() {
    this.cli = new Cli()
    this.command = new Command()
    this.command
      .version('0.1.0')
      .name('salto-cli')
      .description(
        'salto is a business operations as code tool, allowing one to manage all aspects of his business operations systems in code.',
      )

    this.command
      .command('apply')
      .description(
        'Applies the blueprints in the current working directory onto the related services.',
      )
      .option(
        '-d, --blueprintsdir <value>',
        'A path to a directory containing the needed blueprints.',
      )
      .option(
        '-b, --blueprint <value>',
        'A path to an input blueprint file',
        SaltoCommander.collect,
        [],
      )
      .option('-f, --force', 'A path to an input blueprint file')
      .action(cmd => this.doApply(cmd))

    this.command
      .command('plan')
      .description(
        'Shows the planned actions which will occur in the case of the next *apply* operation.',
      )
      .option(
        '-d, --blueprintsdir <value>',
        'A path to a directory containing the needed blueprints.',
      )
      .option(
        '-b, --blueprint <value>',
        'A path to an input blueprint file',
        SaltoCommander.collect,
        [],
      )
      .action(cmd => this.doPlan(cmd))

    this.command
      .command('discover')
      .description(
        'Generates blueprints and state files which represent the difference between the current state of the related services, and the configuration and state currently captured by salto.',
      )
      .option(
        '-d, --blueprintsdir <value>',
        'A path to a directory containing the needed blueprints.',
      )
      .option(
        '-b, --blueprint <value>',
        'A path to an input blueprint file',
        SaltoCommander.collect,
        [],
      )
      .option(
        '-o, --outputfilename <path>',
        'A path to the output blueprint file',
      )
      .action(cmd => this.doDiscover(cmd))

    this.command
      .command('describe <searchWords>')
      .option(
        '-r --recursion-level <number>',
        'Set how many configuations levels will be shown',
        SaltoCommander.parseIntArg,
        2,
      )
      .description(
        'Shows all available types and attributes for the adapters of the related services.',
      )
      .action((searchWords, cmd) => this.doDescribe(searchWords, cmd))
  }

  async parseAndRun(argv: string[]): Promise<void> {
    this.command.parse(argv)
  }

  private static collect(value: string, prev: string[]): string[] {
    return prev.concat([value])
  }

  private static parseIntArg(value: string): number {
    // parseInt takes a string and an optional radix
    return parseInt(value, 10)
  }

  private static parseDotSeperate(value: string): string[] {
    return value.split('.')
  }

  private doApply(cmd: {
    blueprint: string[]
    blueprintsdir: string
    force: boolean
  }): void {
    this.cli.apply(cmd.blueprint, cmd.blueprintsdir, cmd.force)
  }

  private doPlan(cmd: { blueprint: string[]; blueprintsdir: string }): void {
    this.cli.plan(cmd.blueprint, cmd.blueprintsdir)
  }

  private doDiscover(cmd: {
    outputfilename: string
    blueprint: string[]
    blueprintsdir: string
  }): void {
    this.cli.discover(cmd.outputfilename, cmd.blueprint, cmd.blueprintsdir)
  }

  private doDescribe(
    searchWords: string,
    cmd: { recursionLevel: number },
  ): void {
    this.cli.describe(SaltoCommander.parseDotSeperate(searchWords), cmd.recursionLevel)
  }
}

// WHAT? This tells jest to ignore this brach, as it should.
/* istanbul ignore next */

if (typeof require !== 'undefined' && require.main === module) {
  const saltoCommander = new SaltoCommander()
  saltoCommander.parseAndRun(process.argv)
}

export default new SaltoCommander()
