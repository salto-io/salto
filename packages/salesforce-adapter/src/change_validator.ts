import { Change, Element, ChangeValidator, ChangeError } from 'adapter-api'
import { filterHasMember } from '@salto/lowerdash/dist/src/types'
import _ from 'lodash'
import packageValidator from './change_validators/package'


const changeValidators: Partial<ChangeValidator>[] = [
  packageValidator,
]

const runOnUpdateValidators = async (changes: ReadonlyArray<Change>):
  Promise<ReadonlyArray<ChangeError>> =>
  _.flatten(await Promise.all(
    filterHasMember('onUpdate', changeValidators)
      .map(v => v.onUpdate(changes))
  ))

const runOnAddValidators = async (after: Element): Promise<ReadonlyArray<ChangeError>> =>
  _.flatten(await Promise.all(
    filterHasMember('onAdd', changeValidators)
      .map(v => v.onAdd(after))
  ))

const runOnRemoveValidators = async (before: Element): Promise<ReadonlyArray<ChangeError>> =>
  _.flatten(await Promise.all(
    filterHasMember('onRemove', changeValidators)
      .map(v => v.onRemove(before))
  ))

export const changeValidator: ChangeValidator = {
  onUpdate: (changes: ReadonlyArray<Change>) => runOnUpdateValidators(changes),
  onAdd: (after: Element) => runOnAddValidators(after),
  onRemove: (before: Element) => runOnRemoveValidators(before),
}
