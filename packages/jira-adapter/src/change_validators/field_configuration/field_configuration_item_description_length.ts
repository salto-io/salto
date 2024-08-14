/*
Copyright 2024 Salto Labs Ltd.
Licensed under the Salto Terms of Use (the "License");
You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use

CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import _ from 'lodash'
import {
  ChangeValidator,
  getChangeData,
  isInstanceChange,
  SeverityLevel,
  isAdditionOrModificationChange,
  InstanceElement,
  ElemID,
} from '@salto-io/adapter-api'
import {
  FIELD_CONFIGURATION_TYPE_NAME,
  FIELD_CONFIGURATION_ITEM_DESCRIPTION_MAX_LENGTH,
  FIELD_CONFIGURATION_ITEM_TYPE_NAME,
} from '../../constants'

type DescribedType = { description: string }
type DescribedElementType = { elemID: ElemID } & DescribedType

const isDescriptionTooLong = (obj: DescribedType): boolean =>
  obj.description !== undefined && obj.description.length > FIELD_CONFIGURATION_ITEM_DESCRIPTION_MAX_LENGTH
const convertToDescribedElementType = (inst: InstanceElement): DescribedElementType[] => {
  if (inst.elemID.typeName === FIELD_CONFIGURATION_ITEM_TYPE_NAME) {
    return [{ elemID: inst.elemID, description: inst.value.description }]
  }

  return Object.entries(inst.value.fields)
    .map(([itemName, item]) => ({
      elemID: inst.elemID.createNestedID('fields', itemName),
      description: _.get(item, 'description'),
    }))
    .filter(describedObj => describedObj.description !== undefined)
}
export const fieldConfigurationItemDescriptionLengthValidator: ChangeValidator = async changes =>
  changes
    .filter(isInstanceChange)
    .filter(isAdditionOrModificationChange)
    .map(getChangeData)
    .filter(
      inst =>
        inst.elemID.typeName === FIELD_CONFIGURATION_TYPE_NAME ||
        inst.elemID.typeName === FIELD_CONFIGURATION_ITEM_TYPE_NAME,
    )
    .flatMap(convertToDescribedElementType)
    .filter(isDescriptionTooLong)
    .map(item => ({
      elemID: item.elemID,
      severity: 'Error' as SeverityLevel,
      message: 'Description length exceeded maximum.',
      detailedMessage: `Description length (${item.description.length}) of field configuration item exceeded the allowed maximum of ${FIELD_CONFIGURATION_ITEM_DESCRIPTION_MAX_LENGTH} characters.`,
    }))
