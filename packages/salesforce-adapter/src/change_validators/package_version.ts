/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */

import {
  ChangeError,
  // ChangeError,
  ChangeValidator,
  // ElemID,
  getChangeData,
  InstanceElement,
  isAdditionOrModificationChange,
  isInstanceChange,
  // ReadOnlyElementsSource,
  // ReferenceExpression,
} from '@salto-io/adapter-api'
// import { collections } from '@salto-io/lowerdash'
import {
  APEX_CLASS_METADATA_TYPE,
  APEX_COMPONENT_METADATA_TYPE,
  APEX_PAGE_METADATA_TYPE,
  APEX_TRIGGER_METADATA_TYPE,
  EMAIL_TEMPLATE_METADATA_TYPE,
} from '../constants'

// const { awu } = collections.asynciterable

type TypeToValidate = {
  type: string
  exactVersion: boolean
}

const TYPES_TO_VALIDATE: TypeToValidate[] = [
  { type: APEX_CLASS_METADATA_TYPE, exactVersion: false },
  { type: APEX_PAGE_METADATA_TYPE, exactVersion: false },
  { type: APEX_COMPONENT_METADATA_TYPE, exactVersion: false },
  { type: EMAIL_TEMPLATE_METADATA_TYPE, exactVersion: false },
  { type: APEX_TRIGGER_METADATA_TYPE, exactVersion: true },
]

const isOfTypeToValidate = (instance: InstanceElement): boolean =>
  TYPES_TO_VALIDATE.some(type => type.type === instance.getTypeSync().elemID.typeName)

// const isValidPackageVersion=(elementSource: ReadOnlyElementsSource|undefined): (instance:InstanceElement)=>boolean{
//   return (instance:InstanceElement)=>{
//     return instance?false:true
//   }
// }

// const createPackageVersionsError = (instance: InstanceElement): ChangeError => {

// }

const createPackageVersionErrors = (instance: InstanceElement): ChangeError[] => {
  // for every instance return a list of change errors, if no errors found return empty list
  return []
}

const changeValidator: ChangeValidator = async changes => {
  const instanceChangesErrors = changes
    .filter(isAdditionOrModificationChange)
    .filter(isInstanceChange)
    .map(getChangeData)
    .filter(isOfTypeToValidate)
    .flatMap(createPackageVersionErrors)
  console.log(instanceChangesErrors)
  return []
}

export default changeValidator
