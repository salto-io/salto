import { Element, ElemID, Value } from 'adapter-api'

export interface ElementsSource {
  list(): Promise<ElemID[]>
  get(id: ElemID): Promise<Element | Value>
  getAll(): Promise<Element[]>
  flush(): Promise<void>
}
