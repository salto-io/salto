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
import wu from 'wu'
import { DependencyChanger } from '@salto-io/adapter-api'
import { fieldsByCustomTab } from './dependency_changers/fields_by_custom_tab'

const dependencyChangers: ReadonlyArray<DependencyChanger> = [
  fieldsByCustomTab,
]

type DependencyChangersRunner = (changers: ReadonlyArray<DependencyChanger>) => DependencyChanger
export const dependencyChangersRunner: DependencyChangersRunner = changers => (
  async (changes, dependencies) => (
    wu.chain(...await Promise.all(changers.map(changer => changer(changes, dependencies))))
  )
)

export const dependencyChanger = dependencyChangersRunner(dependencyChangers)
