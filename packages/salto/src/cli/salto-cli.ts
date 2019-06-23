#!/usr/bin/env node
import { Command } from 'commander'
import Cli from './commands'

const cli = new Cli()

function collect(value: string, prev: string[]): string[] {
  return prev.concat([value])
}

function parseIntArg(value: string): number {
  // parseInt takes a string and an optional radix
  return parseInt(value, 10)
}

function parseDotSeperate(value: string): string[] {
  return value.split('.')
}

function doApply(cmd: {
  blueprint: string[]
  blueprintsdir: string
  force: boolean
}): void {
  cli.apply(cmd.blueprint, cmd.blueprintsdir, cmd.force)
}

function doPlan(cmd: { blueprint: string[]; blueprintsdir: string }): void {
  cli.plan(cmd.blueprint, cmd.blueprintsdir)
}

function doDiscover(): void {
  cli.discover()
}

function doDescribe(
  searchWords: string,
  cmd: { recursionLevel: number }
): void {
  cli.describe(parseDotSeperate(searchWords), cmd.recursionLevel)
}

class SaltoCommander {
  private command: Command

  constructor() {
    this.command = new Command()
    this.command
      .version('0.1.0')
      .name('salto-cli')
      .description(
        'salto is a business operations as code tool, allowing one to manage all aspects of his business operations systems in code.'
      )

    this.command
      .command('apply')
      .description(
        'Applies the blueprints in the current working directory onto the related services.'
      )
      .option(
        '-d, --blueprintsdir <value>',
        'A path to a directory containing the needed blueprints.'
      )
      .option(
        '-b, --blueprint <value>',
        'A path to an input blueprint file',
        collect,
        []
      )
      .option('-f, --force', 'A path to an input blueprint file')
      .action(doApply)

    this.command
      .command('plan')
      .description(
        'Shows the planned actions which will occur in the case of the next *apply* operation.'
      )
      .option(
        '-d, --blueprintsdir <value>',
        'A path to a directory containing the needed blueprints.'
      )
      .option(
        '-b, --blueprint <value>',
        'A path to an input blueprint file',
        collect,
        []
      )
      .action(doPlan)

    this.command
      .command('discover')
      .description(
        'Generates blueprints and state files which represent the difference between the current state of the related services, and the configuration and state currently captured by salto.'
      )
      .action(doDiscover)

    this.command
      .command('describe <searchWords>')
      .option(
        '-r --recursion-level <number>',
        'Set how many configuations levels will be shown',
        parseIntArg,
        2
      )
      .description(
        'Shows all available types and attributes for the adapters of the related services.'
      )
      .action(doDescribe)
  }

  async parseAndRun(argv: string[]): Promise<void> {
    this.command.parse(argv)
  }
}

// WHAT? This tells jest to ignore this brach, as it should.
/* istanbul ignore next */

if (typeof require !== 'undefined' && require.main === module) {
  const saltoCommander = new SaltoCommander()
  saltoCommander.parseAndRun(process.argv)
}

export default new SaltoCommander()
