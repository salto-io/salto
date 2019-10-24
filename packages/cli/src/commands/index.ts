import { YargsCommandBuilder } from '../command_builder'
import discoverBuilder from './discover'
import describeBuilder from './describe'
import planBuilder from './plan'
import applyBuilder from './apply'
import exportBuilder from './export'
import importBuilder from './import'
import deleteBuilder from './delete'
import initBuilder from './init'


// The order of the builders determines order of appearance in help text
export default [
  initBuilder,
  discoverBuilder,
  describeBuilder,
  planBuilder,
  applyBuilder,
  exportBuilder,
  importBuilder,
  deleteBuilder,
] as YargsCommandBuilder[]
