@{%
	const _ =  require('lodash')
	const lexer = require('../parser/internal/lexer').default
	const valueConverters = require('../parser/internal/converter/values')
	const elementConverters = require('../parser/internal/converter/elements')
	// This file is auto-generated using nearly js (see build-parser in package.json)
	// Do not attempt to modifiy this file, modify hcl.ne instead. (unless you are in hcl.ne)
	// in that case - have a blast!
%}

# Pass your lexer object using the @lexer option:
@lexer lexer

main -> _ elements _ {% d => d[1] %}
	| _ {%d => [] %}
elements ->
	  element
    | elements __ element {% d => d[0].concat(d[2]) %}
element -> blockLabels %ws oObj _ blockItems _ cObj {% d => elementConverters.converTopLevelBlock(d[0], d[4], d[6]) %}
	| blockLabels %ws oObj _ cObj {% d => elementConverters.converTopLevelBlock(d[0], [], d[4]) %}
blockLabels ->
	  label
	| blockLabels %ws label {% d => d[0].concat(d[2]) %}
blockItems ->
	  blockItem
	| blockItems %ws blockItem {% d => d[0].concat(d[2]) %}
blockItem ->
	  attr {% id %}
	| block {% id %}
block -> blockLabels %ws oObj _ blockItems _ cObj {% d => elementConverters.convertNestedBlock(d[0], d[4], d[6]) %}
	| blockLabels %ws oObj _ cObj {% d => elementConverters.convertNestedBlock(d[0], [], d[4]) %}
label ->
	  %word {% id %}
	| string {% id %}
attr ->
      %word _ eq _ value {% d => valueConverters.convertAttr(d[0], d[4]) %}
	| string _ eq _ value {% d => valueConverters.convertAttr(d[0], d[4]) %}
    | %wildcard _ eq _ value {% d => valueConverters.convertAttr(d[0], d[4]) %}
array -> oArr _ arrayItems _ cArr {% d => valueConverters.convertArray(d[0], d[2], d[4])%}
	| oArr _ cArr {% d => valueConverters.convertArray(d[0], [], d[2])%}
arrayItems ->
	  value {% d => [d[0]] %}
	| arrayItems _ comma _ value {% d => d[0].concat(d[4]) %}
	| arrayItems _ comma {% d => d[0] %}
object -> oObj _ objectItems _ cObj {% d => valueConverters.convertObject(d[0], d[2], d[4]) %}
	| oObj _ cObj {% d => valueConverters.convertObject(d[0], [], d[2]) %}
objectItems ->
	  attr {% d => d %}
	| objectItems %ws attr {% d => d[0].concat(d[2]) %}
value ->
	  primitive {% id %}
	| array {% id %}
	| object {% id %}
	| func {% id %}

primitive ->
	  %number {% d => valueConverters.convertNumber(d[0]) %}
	| string {% id %}
	| %boolean {% d => valueConverters.convertBoolean(d[0]) %}
	| %word {% d => valueConverters.convertReference(d[0]) %}
	| multilineString {% id %}
	| %wildcard {% d => valueConverters.convertWildcard(d[0]) %}


func -> %word args {% d => valueConverters.convertFunction(d[0], d[1][2], d[1][4]) %}
args -> "(" _ arrayItems _ ")" {% d => d %}

string -> "\"" (content {% id %} |reference {% id %}):* stringEnd {% d => valueConverters.convertString(d[0], d[1], d[2]) %}
multilineString -> %mlStart (reference {% id %} | content {% id %}):* %mlEnd {% d => valueConverters.convertMultilineString(d[0], d[1], d[2]) %}
stringEnd -> "\"" {% id %} | %wildcard {% id %}
content -> %content {% id %} | %wildcard {% id %}
reference -> %reference {% id %} | %wildcard {% id %}
oArr -> "[" {% id %} | %wildcard {% id %}
cArr -> "]" {% id %} | %wildcard {% id %}
oObj -> "{" {% id %} | %wildcard {% id %}
cObj -> "}" {% id %} | %wildcard {% id %}
eq -> "=" {% id %} | %wildcard {% id %}
comma -> "," {% id %} | %wildcard {% id %}
_ -> (%ws | %comment):* {% () => null %}
__ -> (%ws | %comment):+ {% () => null %}
