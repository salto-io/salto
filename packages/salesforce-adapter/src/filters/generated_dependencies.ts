/*
* Copyright 2024 Salto Labs Ltd.
* Licensed under the Salto Terms of Use (the "License");
* You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
*
* CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
*/
import { ChangeDataType, CORE_ANNOTATIONS, getChangeData, isAdditionOrModificationChange } from '@salto-io/adapter-api'
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
    preDeploy: async changes => {
      generatedDependencies = Object.fromEntries(
        changes
          .filter(isAdditionOrModificationChange)
          .map(getChangeData)
          .filter(
            (element): element is ElementWithGeneratedDependencies =>
              element.annotations[CORE_ANNOTATIONS.GENERATED_DEPENDENCIES] !== undefined,
          )
          .map(element => {
            const deps = element.annotations[CORE_ANNOTATIONS.GENERATED_DEPENDENCIES]
            const optionalElement: ChangeDataType = element // Deletion not supported for required keys
            delete optionalElement.annotations[CORE_ANNOTATIONS.GENERATED_DEPENDENCIES]
            return [element.elemID.getFullName(), deps]
          }),
      )
    },
    onDeploy: async changes => {
      changes
        .filter(isAdditionOrModificationChange)
        .map(getChangeData)
        .filter(element => generatedDependencies[element.elemID.getFullName()] !== undefined)
        .forEach(element => {
          element.annotations[CORE_ANNOTATIONS.GENERATED_DEPENDENCIES] =
            generatedDependencies[element.elemID.getFullName()]
        })
    },
  }
}

export default filterCreator
