import { Change, Element, ChangeValidator, ChangeError } from 'adapter-api'
import { types } from '@salto/lowerdash'
import _ from 'lodash'
import jsonTypeValidator from './change_validators/json_type'

const changeValidators: Partial<ChangeValidator>[] = [
  jsonTypeValidator,
]

const runOnUpdateValidators = async (changes: ReadonlyArray<Change>):
  Promise<ReadonlyArray<ChangeError>> =>
  _.flatten(await Promise.all(
    types.filterHasMember('onUpdate', changeValidators)
      .map(v => v.onUpdate(changes))
  ))

const runOnAddValidators = async (after: Element): Promise<ReadonlyArray<ChangeError>> =>
  _.flatten(await Promise.all(
    types.filterHasMember('onAdd', changeValidators)
      .map(v => v.onAdd(after))
  ))

const runOnRemoveValidators = async (before: Element): Promise<ReadonlyArray<ChangeError>> =>
  _.flatten(await Promise.all(
    types.filterHasMember('onRemove', changeValidators)
      .map(v => v.onRemove(before))
  ))

export const changeValidator: ChangeValidator = {
  onUpdate: (changes: ReadonlyArray<Change>) => runOnUpdateValidators(changes),
  onAdd: (after: Element) => runOnAddValidators(after),
  onRemove: (before: Element) => runOnRemoveValidators(before),
}
