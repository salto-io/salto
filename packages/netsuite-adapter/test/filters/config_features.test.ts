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
import { BuiltinTypes, Change, ElemID, getChangeData, InstanceElement, isListType, ObjectType, toChange } from '@salto-io/adapter-api'
import filterCreator from '../../src/filters/config_features'
import { FeaturesDeployError } from '../../src/client/errors'
import { CONFIG_FEATURES, NETSUITE } from '../../src/constants'
import { featuresType } from '../../src/types/configuration_types'

const getChange = (): Change<InstanceElement> => {
  const type = new ObjectType({
    elemID: new ElemID(NETSUITE, CONFIG_FEATURES),
    fields: {
      ABC: { refType: BuiltinTypes.BOOLEAN },
      DEF: { refType: BuiltinTypes.BOOLEAN },
    },
  })
  const before = new InstanceElement(
    ElemID.CONFIG_NAME,
    type,
    { ABC: false, DEF: false }
  )
  const after = new InstanceElement(
    ElemID.CONFIG_NAME,
    type,
    { ABC: true, DEF: true }
  )
  return toChange({ before, after })
}

describe('config features filter', () => {
  describe('onFetch', () => {
    let instance: InstanceElement
    beforeEach(() => {
      instance = new InstanceElement(
        '_config',
        featuresType(),
        {
          feature: [
            { id: 'ABC', label: 'A Blue Cat', status: 'ENABLED' },
            { id: 'DEF', label: 'Delightful Elephents Family', status: 'DISABLED' },
            { id: 'NO', label: 'Not O', status: 'UNKNOWN' },
          ],
        }
      )
    })

    it('should transform values', async () => {
      await filterCreator().onFetch([instance])
      const type = await instance.getType()
      expect(Object.keys(type.fields)).toEqual(['ABC', 'DEF', 'NO'])
      expect(type.fields.ABC.annotations).toEqual({ label: 'A Blue Cat' })
      expect(type.fields.DEF.annotations).toEqual({ label: 'Delightful Elephents Family' })
      expect(type.fields.NO.annotations).toEqual({ label: 'Not O' })
      expect(instance.value).toEqual({ ABC: true, DEF: false, NO: 'UNKNOWN' })
    })
    it('should remove features type when there is no instance', async () => {
      const elements = [featuresType()]
      await filterCreator().onFetch(elements)
      expect(elements.length).toEqual(0)
    })
  })
  describe('preDeploy', () => {
    it('should transform values', async () => {
      const change = getChange()
      await filterCreator().preDeploy([change])
      const instance = getChangeData(change)
      const type = await instance.getType()

      const { feature } = type.fields
      const fieldType = await feature.getType()
      expect(isListType(fieldType)).toBeTruthy()
      expect(isListType(fieldType) && fieldType.refInnerType.elemID.typeName)
        .toEqual(`${CONFIG_FEATURES}_feature`)
      expect(instance.value).toEqual({
        feature: [
          { id: 'ABC', status: 'ENABLED' },
          { id: 'DEF', status: 'ENABLED' },
        ],
      })
    })
  })
  describe('onDeploy', () => {
    it('should succeed', async () => {
      const change = getChange()
      await filterCreator().onDeploy([change], { errors: [new Error('error')], appliedChanges: [] })
      expect(getChangeData(change).value).toEqual({ ABC: true, DEF: true })
    })
    it('should restore failed to deploy features', async () => {
      const change = getChange()
      await filterCreator().onDeploy([change], { errors: [new FeaturesDeployError('error', ['ABC'])], appliedChanges: [] })
      expect(getChangeData(change).value).toEqual({ ABC: false, DEF: true })
    })
  })
})
