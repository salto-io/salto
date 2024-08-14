/*
Copyright 2024 Salto Labs Ltd.
Licensed under the Salto Terms of Use (the "License");
You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use

CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { elements as elementUtils } from '@salto-io/adapter-components'
import { GROUP_TYPE_NAME } from './constants'

const oktaNameCriterion: elementUtils.query.QueryCriterion = ({ instance, value }): boolean =>
  instance.elemID.typeName === GROUP_TYPE_NAME
    ? elementUtils.query.fieldCriterionCreator('profile.name')({ instance, value })
    : elementUtils.query.nameCriterion({ instance, value })

export default {
  name: oktaNameCriterion,
  type: elementUtils.query.fieldCriterionCreator('type'),
  status: elementUtils.query.fieldCriterionCreator('status'),
}
