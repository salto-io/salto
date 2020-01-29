import { DiffGraphTransformer } from '@salto/dag'
import { ChangeDataType, ElemID, Change } from 'adapter-api'

export type PlanTransformer = DiffGraphTransformer<ChangeDataType>

export const changeId = ({ elemID }: { elemID: ElemID }, action: Change['action']): string =>
  `${elemID.getFullName()}/${action}`
