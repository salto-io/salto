/*
Copyright 2024 Salto Labs Ltd.
Licensed under the Salto Terms of Use (the "License");
You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use

CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { elements as elementUtils } from '@salto-io/adapter-components'
import { regex } from '@salto-io/lowerdash'

const typeCriterion: elementUtils.query.QueryCriterion = ({ instance, value }): boolean =>
  regex.isFullRegexMatch(instance.value.schema?.custom ?? instance.value.schema?.type, value)

export default {
  name: elementUtils.query.nameCriterion,
  type: typeCriterion,
  state: elementUtils.query.fieldCriterionCreator('state'),
}
