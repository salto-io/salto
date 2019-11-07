import { YargsCommandBuilder } from '../command_builder'
import fetchBuilder from './fetch'
import previewBuilder from './preview'
import deployBuilder from './deploy'
import exportBuilder from './export'
import importBuilder from './import'
import deleteBuilder from './delete'
import initBuilder from './init'


// The order of the builders determines order of appearance in help text
export default [
  initBuilder,
  fetchBuilder,
  previewBuilder,
  deployBuilder,
  exportBuilder,
  importBuilder,
  deleteBuilder,
] as YargsCommandBuilder[]
