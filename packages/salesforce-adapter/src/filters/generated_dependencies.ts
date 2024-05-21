/*
 *                      Copyright 2024 Salto Labs Ltd.
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
import {
  ChangeDataType,
  ChangeDataKeys,
  changeId,
  CORE_ANNOTATIONS,
} from '@salto-io/adapter-api'
import { DetailedDependency } from '@salto-io/adapter-utils'
import { LocalFilterCreator } from '../filter'

/**
 * Remove generated dependencies before deploy.
 */
const filterCreator: LocalFilterCreator = () => {
  let generatedDependencies: Record<
    string,
    Record<ChangeDataKeys, DetailedDependency[]>
  >

  const popGeneratedDependencies = (
    element?: ChangeDataType,
  ): DetailedDependency[] | undefined => {
    const deps = element?.annotations[CORE_ANNOTATIONS.GENERATED_DEPENDENCIES]
    delete element?.annotations[CORE_ANNOTATIONS.GENERATED_DEPENDENCIES]
    return deps
  }

  return {
    name: 'generatedDependencies',
    preDeploy: async (changes) => {
      generatedDependencies = Object.fromEntries(
        changes.map((change) => [
          changeId(change),
          Object.fromEntries(
            Object.entries(change.data)
              .map(([k, element]) => [k, popGeneratedDependencies(element)])
              .filter(([, dependencies]) => dependencies !== undefined),
          ),
        ]),
      )
    },
    onDeploy: async (changes) => {
      changes.forEach((change) => {
        const id = changeId(change)
        Object.entries(change.data).forEach(([k, element]) => {
          const deps = generatedDependencies[id]?.[k as ChangeDataKeys]
          if (deps === undefined) {
            return
          }
          element.annotations[CORE_ANNOTATIONS.GENERATED_DEPENDENCIES] = deps
        })
      })
    },
  }
}

export default filterCreator
