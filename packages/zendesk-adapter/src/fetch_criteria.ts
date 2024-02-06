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
import { elements as elementUtils } from '@salto-io/adapter-components'
import { InstanceElement, Value } from '@salto-io/adapter-api'
import { TICKET_FORM_TYPE_NAME, WEBHOOK_TYPE_NAME } from './constants'

const activeFieldCriteria = ({ instance, value }: {instance: InstanceElement; value: Value}): boolean => {
  const { typeName } = instance.elemID
  if (typeName === WEBHOOK_TYPE_NAME) {
    if (value === true) {
      return instance.value.status !== 'inactive'
    }
    return instance.value.status === 'inactive'
  }
  // We can't omit inactive ticket_form instances because we need all the instance in order to reorder them
  // If we decided to change that we need to add warning in the ticket_field_deactivation CV
  if (typeName === TICKET_FORM_TYPE_NAME || instance.value.active === undefined) {
    return true
  }
  return instance.value.active === value
}

export default {
  name: elementUtils.query.nameCriterion,
  key: elementUtils.query.fieldCriterionCreator('key'),
  raw_title: elementUtils.query.fieldCriterionCreator('raw_title'),
  title: elementUtils.query.fieldCriterionCreator('title'),
  type: elementUtils.query.fieldCriterionCreator('type'),
  active: activeFieldCriteria,
}
