import { YargsCommandBuilder } from '../command_builder'
import discoverBuilder from './discover'
import describeBuilder from './describe'
import planBuilder from './plan'
import applyBuilder from './apply'
import exportBuilder from './export'
import importBuilder from './import'
import deleteBuilder from './delete'


// The order of the commands determines order of appearance in help text
const builders = [
  discoverBuilder,
  describeBuilder,
  planBuilder,
  applyBuilder,
  exportBuilder,
  importBuilder,
  deleteBuilder,
] as YargsCommandBuilder[]

export default builders
