/*
Copyright 2024 Salto Labs Ltd.
Licensed under the Salto Terms of Use (the "License");
You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use

CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import {
  getChangeData,
  InstanceElement,
  isEqualValues,
  isInstanceChange,
  isModificationChange,
  ModificationChange,
  Element,
} from '@salto-io/adapter-api'
import { collections } from '@salto-io/lowerdash'
import _ from 'lodash'
import { getElementValueOrAnnotations, isDataObjectType } from '../types'
import { LocalFilterCreator } from '../filter'
import { ATTRIBUTES } from '../client/suiteapp_client/constants'

const { awu } = collections.asynciterable

export const getDifferentKeys = (change: ModificationChange<Element>): Set<string> => {
  const afterValues = getElementValueOrAnnotations(change.data.after)
  const beforeValues = getElementValueOrAnnotations(change.data.before)
  return new Set(Object.keys(afterValues).filter(key => !isEqualValues(afterValues[key], beforeValues[key])))
}

export const removeIdenticalValues = (change: ModificationChange<InstanceElement>): void => {
  const differentKeys = getDifferentKeys(change)
  Object.values(change.data).forEach(element => {
    element.value = _.pickBy(element.value, (_value, key) => differentKeys.has(key) || key === ATTRIBUTES)
  })
}

const filterCreator: LocalFilterCreator = () => ({
  name: 'dataInstancesDiff',
  preDeploy: async changes => {
    await awu(changes)
      .filter(isModificationChange)
      .filter(isInstanceChange)
      .filter(async change => isDataObjectType(await getChangeData<InstanceElement>(change).getType()))
      .forEach(removeIdenticalValues)
  },
})

export default filterCreator
