import sourceMapSupport from 'source-map-support'
import cli from './cli'
import commandBuilders from './commands'
import oraSpinner from './ora_spinner'

sourceMapSupport.install()

const {
  stdin, stdout, stderr, argv,
} = process

const oraSpinnerCreator = oraSpinner({ outputStream: stdout })

const args = argv.slice(2)

cli({
  input: { args, stdin },
  output: { stdout, stderr },
  commandBuilders,
  spinnerCreator: oraSpinnerCreator,
}).then(exitCode => process.exit(exitCode))
