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
  CORE_ANNOTATIONS,
  getChangeData,
  isAdditionOrModificationChange,
} from '@salto-io/adapter-api'
import { DetailedDependency } from '@salto-io/adapter-utils'
import { LocalFilterCreator } from '../filter'

type ElementWithGeneratedDependencies = ChangeDataType & {
  annotations: ChangeDataType['annotations'] & {
    [CORE_ANNOTATIONS.GENERATED_DEPENDENCIES]: DetailedDependency[]
  }
}

/**
 * Remove generated dependencies before deploy.
 */
const filterCreator: LocalFilterCreator = () => {
  let generatedDependencies: Record<string, DetailedDependency[]>

  return {
    name: 'generatedDependencies',
    preDeploy: async (changes) => {
      generatedDependencies = Object.fromEntries(
        changes
          .filter(isAdditionOrModificationChange)
          .map(getChangeData)
          .filter(
            (element): element is ElementWithGeneratedDependencies =>
              element.annotations[CORE_ANNOTATIONS.GENERATED_DEPENDENCIES] !==
              undefined,
          )
          .map((element) => {
            const deps =
              element.annotations[CORE_ANNOTATIONS.GENERATED_DEPENDENCIES]
            const optionalElement: ChangeDataType = element // Deletion not supported for required keys
            delete optionalElement.annotations[
              CORE_ANNOTATIONS.GENERATED_DEPENDENCIES
            ]
            return [element.elemID.getFullName(), deps]
          }),
      )
    },
    onDeploy: async (changes) => {
      changes
        .filter(isAdditionOrModificationChange)
        .map(getChangeData)
        .filter(
          (element) =>
            generatedDependencies[element.elemID.getFullName()] !== undefined,
        )
        .forEach((element) => {
          element.annotations[CORE_ANNOTATIONS.GENERATED_DEPENDENCIES] =
            generatedDependencies[element.elemID.getFullName()]
        })
    },
  }
}

export default filterCreator
