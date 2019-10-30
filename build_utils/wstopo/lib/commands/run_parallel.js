import child_process from 'child_process'

const STREAM_NAMES = ['stdout', 'stderr']

export default {
  name: 'run-parallel',
  usage: '[cmd [args...]]',
  description: [
    'execute cmd for each workspace concurrently in topological order.',
    '',
    'if cmd is omitted, "yarn" is executed by default'
  ].join('\n'),
  execute: ({ workspaces, args, process }) => {
    const [cmd, ...cmdArgs] = args.length === 0 ? ['yarn'] : args
    const { dir, walk } = workspaces
    const padId = workspaces.padId(':')

    return walk(id => new Promise((resolve, reject) => {
      const child = child_process.spawn(cmd, cmdArgs, { cwd: dir(id) })
      const paddedId = padId(id)

      STREAM_NAMES.forEach(stream => child[stream].on('data', data => {
        process[stream].write([paddedId, data.toString('utf8')].join(' '))
      }))

      child.on('error', err => reject(`cmd ${[cmd, cmdArgs].join(' ')} for ${id} ended with error ${err}`))
      child.on('exit', code => code === 0
        ? resolve()
        : reject(`cmd ${cmd.join(' ')} for ${id} ended with code ${code}`)
      )
    }))
  }
}
