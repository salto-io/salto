import salesforce from './salesforce'

const adapters = [
  salesforce(),
]

export default Object.assign({}, ...adapters.map(a => ({ [a.name]: a })))
