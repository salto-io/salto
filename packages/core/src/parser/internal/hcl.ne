@{%
	const _  =  require('lodash')
	const lexer = require('./lexer').default
	const converters = require('./converters')
	// This file is auto-generated using nearly js (see build-parser in package.json)
	// Do not attempt to modifiy this file, modify hcl.ne instead. (unless you are in hcl.ne)
	// in that case - have a blast!
%}

# Pass your lexer object using the @lexer option:
@lexer lexer

main -> _nl (blockItem __nl:? {% d=> d[0] %}):* {% d=> _.flatten(d.filter(d => d)) %}
block -> blockLabels oObj _nl (blockItem __nl {% id %}):* cObj {% d => converters.convertBlock(d[0], d[3], d[4]) %}
blockLabels -> label __ (label __ {% d => d[0] %}):* {% d=> _.flatten([d[0], d[2]]) %}
label ->
	  %word {% id %}
	| string {% id %}
blockItem ->
	  block {% id %}
	| attr {% id %}
attr -> (word {% id %} | string {% id %}) _ eq _ value {% d => converters.convertAttr(d[0], d[4]) %}
array -> oArr _nl arrayItems cArr {% d => converters.convertArray(d[0], d[2], d[3])%}
arrayItems ->
	  null {% () => [] %}
	| value _nl ("," _nl value _nl {% d => d[2] %}):*  ( "," _nl ):? {% d => _.flatten([d[0], d[2]]) %}
object -> oObj _nl objectItems cObj {% d => converters.convertObject(d[0], d[2], d[3]) %}
objectItems ->(attr _nl {% d=> d[0] %}):* {% d => _.flatten(d[0]) %}
value ->
	  primitive {% id %}
	| array {% id %}
	| object {% id %}
	| func {% id %}

primitive ->
	  %number {% d => converters.convertNumber(d[0]) %}
	| string {% id %}
	| %boolean {% d => converters.convertBoolean(d[0]) %}
	| word {% d => converters.convertReference(d[0]) %}
	| multilineString {% id %}
	| %wildcard {% d => converters.convertWildcard(d[0]) %}


func -> %word args {% d => converters.convertFunction(d[0], d[1][2], d[1][3]) %}
args -> "(" _nl arrayItems ")" {% d => d %}

string -> "\"" (content {% id %} |reference {% id %}):* stringEnd {% d => converters.convertString(d[0], d[1], d[2]) %}
multilineString -> %mlStart (content {% id %} | reference {% id %}):* %mlEnd {% d => converters.convertMultilineString(d[0], d[1], d[2]) %}
stringEnd -> "\"" {% id %} | %wildcard {% id %}
content -> %content {% id %} | %wildcard {% id %}
reference -> %reference {% id %} | %wildcard {% id %}
word -> %word {% id %} | %wildcard {% id %}
oArr -> "[" {% id %} | %wildcard {% id %}
cArr -> "]" {% id %} | %wildcard {% id %}
oObj -> "{" {% id %} | %wildcard {% id %}
cObj -> "}" {% id %} | %wildcard {% id %}
eq -> "=" {% id %} | %wildcard {% id %}
comma -> "," {% id %} | %wildcard {% id %}
_nl  -> (%ws | %newline | %comment ):* {% () => null %}
__nl -> (%ws | %newline | %comment ):+ {% () => null %}
_ -> (%ws | %comment ):* {% () => null %}
__ -> (%ws | %comment ):+ {% () => null %}
