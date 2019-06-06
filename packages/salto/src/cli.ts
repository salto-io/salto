import Log from './log'

export interface TextOutput {
  println(message?: string, ...messageParams: []): void
}

export class Cli {
  args: object

  private log: Log
  private out: TextOutput
  private err: TextOutput

  public constructor({
    logger,
    args,
    out,
    err,
  }: {
    logger: Log
    args: object
    out: TextOutput
    err: TextOutput
  }) {
    this.log = logger
    this.args = args
    this.out = out
    this.err = err
  }

  run(): void {
    this.log.info('CLI run called')
    this.out.println('Out: Hello from Salto CLI')
    this.err.println('Err: Hello from Salto CLI')
  }
}
