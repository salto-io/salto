import chalk from 'chalk'

export const print = (txt: string): void => {
  // eslint-disable-next-line no-console
  console.log(txt)
}

export const printError = (txt: string): void => {
  // eslint-disable-next-line no-console
  console.error(chalk.red(txt))
}

export const header = (txt: string): string => chalk.bold(txt)

export const subHeader = (txt: string): string => chalk.grey(txt)

export const body = (txt: string): string => chalk.reset(txt)

export const warn = (txt: string): string => chalk.red(txt)

export const emptyLine = (): string => ''

export const seperator = (): string => `\n${'-'.repeat(78)}\n`
