/*
*                      Copyright 2020 Salto Labs Ltd.
*
* Licensed under the Apache License, Version 2.0 (the "License");
* you may not use this file except in compliance with
* the License.  You may obtain a copy of the License at
*
*     http://www.apache.org/licenses/LICENSE-2.0
*
* Unless required by applicable law or agreed to in writing, software
* distributed under the License is distributed on an "AS IS" BASIS,
* WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
* See the License for the specific language governing permissions and
* limitations under the License.
*/
import { YargsCommandBuilder } from '../command_builder'
import fetchBuilder from './fetch'
import previewBuilder from './preview'
import deployBuilder from './deploy'
import exportBuilder from './export'
import importBuilder from './import'
import deleteBuilder from './delete'
import initBuilder from './init'
import servicesBuilder from './services'
import envsBuilder from './env'


// The order of the builders determines order of appearance in help text
export default [
  initBuilder,
  fetchBuilder,
  previewBuilder,
  deployBuilder,
  servicesBuilder,
  envsBuilder,
  exportBuilder,
  importBuilder,
  deleteBuilder,
] as YargsCommandBuilder[]
