import path from 'path'
import workspacesCreator from './workspaces'
import commands from './commands'

export default async ({args = process.argv, process = process}) => {
  const [script, commandName, ...opts] = args

  const scriptFile = path.basename(script)

  const usageText = () => `Usage:

${scriptFile} command [opts]

commands:
${commands.map(cmd => `
${cmd.name} ${cmd.usage}
  ${cmd.description}
`).join('\n')}
`

  const usageAndExit = (exitCode) => {
    process.stdout.write(usageText())
    process.exit(exitCode)
  }

  if (commandName === undefined) {
    usageAndExit(1)
  }

  if (commandName === '--help') {
    usageAndExit(0)
  }

  const command = commands.find(c => c.name === commandName)

  if (!command) {
    process.write(`Invalid command ${commandName}, see '${scriptFile} --help'\n`)
    process.exit(2)
  }

  const workspaces = workspacesCreator()

  try {
    const exitCode = await command.execute({ workspaces, args: opts, process })
    process.exit(exitCode || 0)
  } catch(e) {
    process.stderr.write(`Caught error in command:\n${e.stack || e}\n`)
    process.exit(2)
  }
}
