/*
*                      Copyright 2023 Salto Labs Ltd.
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
  isInstanceElement,
  Element,
  ObjectType,
  InstanceElement,
  ElemID,
  CORE_ANNOTATIONS,
  ReferenceExpression,
  BuiltinTypes,
  isInstanceChange,
  isAdditionOrModificationChange,
  getChangeData,
  isReferenceExpression,
} from '@salto-io/adapter-api'
import { logger } from '@salto-io/logging'
import _ from 'lodash'
import { elements as elementsUtils } from '@salto-io/adapter-components'
import { getParent, getParents } from '@salto-io/adapter-utils'
import { FilterCreator } from '../filter'
import {
  CUSTOM_OBJECT_FIELD_OPTIONS_TYPE_NAME,
  CUSTOM_OBJECT_FIELD_TYPE_NAME,
  ZENDESK,
} from '../constants'

const { RECORDS_PATH } = elementsUtils
const log = logger(module)

/**
 *  Parse 'custom_field_options' to values before deploy
 *  Translates 'custom_field_options' changes to custom_object_field changes
 */
const customObjectFieldsFilter: FilterCreator = ({ elementsSource }) => ({
  name: 'customObjectFieldOptionsFilter',
  deploy: async changes => {
    const customObjectFieldChangesNames = new Set<string>(
      changes
        .filter(isInstanceChange)
        .map(getChangeData)
        .filter(instance => instance.elemID.typeName === CUSTOM_OBJECT_FIELD_TYPE_NAME)
        .map(instance => instance.elemID.name)
    )

    const customObjectFieldOptionsChanges = changes
      .filter(isInstanceChange)
      .filter(change => getChangeData(change).elemID.typeName === CUSTOM_OBJECT_FIELD_OPTIONS_TYPE_NAME)

    const [optionsWithParent, optionsWithoutParent] = _.partition(
      customObjectFieldOptionsChanges,
      change => isReferenceExpression(getParents(getChangeData(change))[0])
    )

    // Options that their parent changes are automatically included and does not need to be handled specifically
    const [singleOptionsChanges, leftoverChanges] = _.partition(
      optionsWithParent
        .filter(isInstanceChange)
        .filter(change => getChangeData(change).elemID.typeName === CUSTOM_OBJECT_FIELD_OPTIONS_TYPE_NAME),
      change => !customObjectFieldChangesNames.has(getParent(getChangeData(change)).elemID.name)
    )

    // TODO - translate singleOptionsChanges to custom_object_field changes

    optionsWithoutParent.forEach(change => { /* TODO log */ })

    return {
      deployResult: {
        errors: [],
        appliedChanges: [],
      },
      leftoverChanges: [...leftoverChanges, ...optionsWithoutParent],
    }
  },
})

export default customObjectFieldsFilter
