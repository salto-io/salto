/*
* Copyright 2024 Salto Labs Ltd.
* Licensed under the Salto Terms of Use (the "License");
* You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
*
* CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
*/
import { elements as elementUtils } from '@salto-io/adapter-components'

export default {
  name: elementUtils.query.nameCriterion,
  key: elementUtils.query.fieldCriterionCreator('key'),
  raw_title: elementUtils.query.fieldCriterionCreator('raw_title'),
  title: elementUtils.query.fieldCriterionCreator('title'),
  type: elementUtils.query.fieldCriterionCreator('type'),
}
