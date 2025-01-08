/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { ChangeValidator, Change, ChangeDataType, getChangeData, ElemID } from '@salto-io/adapter-api'
import { values } from '@salto-io/lowerdash'
import { GeneratorParams } from '../generator'

const fromAdapterConfig =
  (config: GeneratorParams): ChangeValidator =>
  async (changes: readonly Change<ChangeDataType>[]) => {
    const elementIdsFromChanges = changes.map(c => getChangeData(c).elemID.getFullName())
    const changeErrors = elementIdsFromChanges.flatMap(elemId =>
      (config.changeErrors ?? []).map(ce => {
        if (ce.elemID === elemId) return { ...ce, elemID: ElemID.fromFullName(elemId) }
        return undefined
      }),
    )
    return changeErrors.filter(values.isDefined)
  }

export default fromAdapterConfig
