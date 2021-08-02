/*
*                      Copyright 2021 Salto Labs Ltd.
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
import { getChangeElement, isInstanceChange,
  ChangeError, Change } from '@salto-io/adapter-api'
import { collections } from '@salto-io/lowerdash'
import NetsuiteClient from '../client/client'

const { awu } = collections.asynciterable

export type ClientChangeValidator = (changes: ReadonlyArray<Change>, client?: NetsuiteClient) =>
 Promise<ReadonlyArray<ChangeError>>

const changeValidator: ClientChangeValidator = async (changes: ReadonlyArray<Change>,
  client?: NetsuiteClient) => {
    console.log('called safe deploy change validator')
    if (client !== undefined) {
      console.log('detected changes in types: %o', changes.map(change => getChangeElement(change).elemID.typeName))

      const changesTypesRecords = await awu(changes)
        .filter(isInstanceChange)
        .map(getChangeElement)
        .map(async elem => elem.getType())
        .map(type => type.elemID.typeName)
        .flatMap(type => client.getAllRecords(type)) // doesn't work, doesn't support all types
        .toArray()
    
      console.log('changesTypesRecords: %o', changesTypesRecords)
      // const modificationInstanceChanges = await awu(changes)
      //   .filter(isModificationChange)
      //   .filter(isInstanceChange)
      //   .toArray() as ModificationChange<InstanceElement>[]
    
      // modificationInstanceChanges.forEach(change => {
      //   const { typeName } = change.data.before.elemID
      //   const record = changesTypesRecords[typeName]
    
      // })    

    }

  return []
}

export default changeValidator
