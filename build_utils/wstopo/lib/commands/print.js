export default {
  name: 'print',
  usage: '',
  description: 'print workspace locations in topological order.',
  execute: ({ workspaces, process }) => workspaces.walk(
    async id => process.stdout.write(`${workspaces.dir(id)}\n`)
  ),
}