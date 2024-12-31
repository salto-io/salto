/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */

import {
  // ChangeError,
  ChangeValidator,
  ElemID,
  // ElemID,
  getChangeData,
  InstanceElement,
  isAdditionOrModificationChange,
  isInstanceChange,
  // ReadOnlyElementsSource,
  // ReferenceExpression,
} from '@salto-io/adapter-api'
import { collections } from '@salto-io/lowerdash'
import { APEX_CLASS_METADATA_TYPE, APEX_TRIGGER_METADATA_TYPE } from '../constants'

const { awu } = collections.asynciterable

const TYPES_TO_VALIDATE = new Set([APEX_CLASS_METADATA_TYPE, APEX_TRIGGER_METADATA_TYPE])

const isOfTypeToValidate = (instance: InstanceElement): boolean =>
  TYPES_TO_VALIDATE.has(instance.getTypeSync().elemID.typeName)

// const isValidPackageVersion=(elementSource: ReadOnlyElementsSource|undefined): (instance:InstanceElement)=>boolean{
//   return (instance:InstanceElement)=>{
//     return instance?false:true
//   }
// }

// const createPackageVersionsError = (instance: InstanceElement): ChangeError => {

// }

const changeValidator: ChangeValidator = async (changes, elementSource) => {
  const instanceChangesErrors = awu(changes)
    .filter(isAdditionOrModificationChange)
    .filter(isInstanceChange)
    .map(getChangeData)
    // .filter(isOfTypeToValidate).filter(isValidPackageVersion(elementSource))
    // .map(createPackageVersionsError)
    .filter(err => err !== undefined)
  const a = await elementSource?.getAll()
  const b = await elementSource?.get(new ElemID('salesforce.InstalledPackage.instance.SBQQ'))
  console.log(instanceChangesErrors, a, b, isOfTypeToValidate)
  return []
}

export default changeValidator
