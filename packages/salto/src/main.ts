import * as winston from 'winston'
import { Cli, TextOutput } from './cli'

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.splat(),
    winston.format.colorize(),
    winston.format.simple()
  ),
  transports: [new winston.transports.Console()],
})

logger.info('Starting')

const outStream = (s: 'stdout' | 'stderr'): TextOutput => ({
  println: (m: string) => process[s].write(`${m}\n`),
})
const stdout = outStream('stdout')
const stderr = outStream('stderr')

const cli = new Cli({ logger, args: {}, out: stdout, err: stderr })

cli.run()
