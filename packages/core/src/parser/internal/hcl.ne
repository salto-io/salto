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

main -> _nl blockItems _nl {% d => d[1] %}
	| _nl {%d => [] %}
block -> blockLabels __ oObj _nl blockItems _nl cObj {% d => converters.convertBlock(d[0], d[4], d[6]) %}
	| blockLabels __ oObj _nl cObj {% d => converters.convertBlock(d[0], [], d[4]) %}
blockItems ->
	  blockItem {% d => d %}
	| blockItems __nl blockItem {% d => d[0].concat(d[2]) %}
blockLabels ->
	label {% d => d %}
	| blockLabels __ label {% d => d[0].concat(d[2]) %}
label ->
	  %word {% id %}
	| string {% id %}
blockItem ->
	  block {% id %}
	| attr {% id %}
attr ->
      %word _ eq _ value {% d => converters.convertAttr(d[0], d[4]) %}
	| string _ eq _ value {% d => converters.convertAttr(d[0], d[4]) %}
    | %wildcard _ eq _ value {% d => converters.convertAttr(d[0], d[4]) %}
array -> oArr _nl arrayItems _nl cArr {% d => converters.convertArray(d[0], d[2], d[4])%}
	| oArr _nl cArr {% d => converters.convertArray(d[0], [], d[2])%}
arrayItems ->
	  value {% d => [d[0]] %}
	| arrayItems _nl comma _nl value {% d => d[0].concat(d[4]) %}
	| arrayItems _nl comma {% d => d[0] %}
object -> oObj _nl objectItems _nl cObj {% d => converters.convertObject(d[0], d[2], d[4]) %}
	| oObj _nl cObj {% d => converters.convertObject(d[0], [], d[2]) %}
objectItems ->
	  attr {% d => d %}
	| objectItems __nl attr {% d => d[0].concat(d[2]) %}
value ->
	  primitive {% id %}
	| array {% id %}
	| object {% id %}
	| func {% id %}

primitive ->
	  %number {% d => converters.convertNumber(d[0]) %}
	| string {% id %}
	| %boolean {% d => converters.convertBoolean(d[0]) %}
	| %word {% d => converters.convertReference(d[0]) %}
	| multilineString {% id %}
	| %wildcard {% d => converters.convertWildcard(d[0]) %}


func -> %word args {% d => converters.convertFunction(d[0], d[1][2], d[1][4]) %}
args -> "(" _nl arrayItems _nl ")" {% d => d %}

string -> "\"" (content {% id %} |reference {% id %}):* stringEnd {% d => converters.convertString(d[0], d[1], d[2]) %}
multilineString -> %mlStart (reference {% id %} | content {% id %}):* %mlEnd {% d => converters.convertMultilineString(d[0], d[1], d[2]) %}
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
_nl ->
   	null {% () => null %}
	| %newline {% () => null %}
	| %ws {% () => null %}
__nl ->
	 %newline {% () => null %}
	| %ws {% () => null %}

_ ->
	null {% () => null %}
	| %ws {% () => null %}
__ -> %ws {% () => null %}
