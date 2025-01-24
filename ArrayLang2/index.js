"use strict"
codetext.addEventListener('keydown', function(e) {
	if (e.key == 'Tab') {
	  e.preventDefault();
	  var start = this.selectionStart;
	  var end = this.selectionEnd;
  
	  // set textarea value to: text before caret + tab + text after caret
	  this.value = this.value.substring(0, start) +
		"\t" + this.value.substring(end);
  
	  // put caret at right position again
	  this.selectionStart =
		this.selectionEnd = start + 1;
	}
  });


/**Replaces all instances of variables in value with the respective substituents
 * 
 * Example:
 * 
 * value = a[0]+a[1]*a[3]
 * 
 * substituents = [a[0]+42,a[2],a[0]*a[0],random(1,3)]
 * 
 * Here the variable a[0], a[1], and a[3] in a[0]+a[1]*a[3] gets replaced with (a[0]+42), a[2], and (random(1,3)); resulting in (a[0]+42)+a[2]*(random(1,3))
 * @param {string} value The value to be substituted
 * @param {string[]} substituents The variable substitutions used to map the variables into
 * @param {RegExp} var_regex The RegExp used to match variables (and capture "index" group), something like /a\[(\d+)\]/g
 * @returns {string} A substituted value
 */
function substitutevariable(value,substituents,var_regex){
	return value.replace(var_regex,
		function(match,as_idx){
			let id = parseInt(as_idx);
			if(isNaN(id)||id<0||id>=substituents.length){
				throw `ERROR: Out of bound detected. This should not happen. Report this error to the developer.`; //No variable detected, this should be caught already on the main function, but who knows.
			}
			let substituent = substituents[id]; //as_idx is string but it gets implicitly converted?!
			//console.log("Instances of",match,"in",value,"will be substituted with",substituent)
			let omitbracket = false;
			omitbracket = omitbracket || match == substituent; //No need parentheses if substituent is same as match
			/* This regex works inline with how the app checks for integers and floats
			Number	JS--	App-	Regex
			0   	true	true	true
			1234	true	true	true
			0123	true*	true	true
			0189	true	true	true
			1.23	true	true	true
			-123	true	true	true
			-1.2	true	true	true
			.123	true	false	false
			-.12	true	false	false
			* = Number is considered an octal
			*/
			omitbracket = omitbracket || /^-?[0-9]+(?:\.[0-9]+)?$/g.test(substituent) //No need parentheses if substituent is purely integer or float (does not match for hexadecimals and binary)
			return omitbracket ? substituent : `(${substituent})`;
		}
	)
}
/**Checks whether the variable indices in the value are valid.
 * @param {string} value The value to be substituted
 * @param {string[]} substituents The variable substitutions used to map the variables into
 * @param {RegExp} var_regex The RegExp used to match variables (and capture "index" group), something like /a\[(\d+)\]/g
 * @returns {boolean} true if variables are valid, false otherwise
 */
function isvalidvariable(value,substituents,var_regex){
	/** @type {RegExpExecArray?} */
	let varres;
	while((varres = var_regex.exec(value)) != null){
		let id = parseInt(varres[1]);
		if(isNaN(id)||id<0||id>=substituents.length){
			return false;
		}
	}
	return true;
}

/**The plan: A scripting language like this:
 * 
 * 	global a[4]
 * 	#this is a comment
 * 	a[0]=1
 * 	if a[1]%2: #this is also a comment, too
 * 		a[1]=a[1]/2
 * 		a[3]=42
 * 	else:
 * 		a[1]=3*a[1]-1
 * 
 * Convert it to something like this:
 * [1,a[1]=1?1:a[1],{1:2,2:3,3:1}[a[2]],a[1]=1?42:a[3]]
 * 
 * g[1] = rand() //rand() -> rand() -> (rand())
 * g[1] = g[1]+5 //g[1]+5 -> (rand())+5 -> ((rand())+5)
 * g[1] = g[1]*2 //g[1]*2 -> ((rand())+5)*2 -> (((rand())+5)*2)
*/
/**[a[0],a[1],a[2]]
 * a[0]=a[1]+2
 * [a[1]+2,a[1],a[2]]
 * a[1]=5
 * [a[1]+2,5,a[2]]
*/
/**[a[0],a[1],a[2]]
 * a[1]=5
 * [a[0],5,a[2]]
 * a[0]=a[1]+2
 * [5+2,5,a[2]]
*/

function test1(){
	codetext.value = 
`array g[4]
##DEFINE goldmoney g[0]
##DEFINE potionitem g[1]
##DEFINE playeraction g[2]
##DEFINE actionresult g[3]
#Comments can be placed on its own in unindented code
if playeraction="buy potion":
	if gold>100:
		goldmoney=goldmoney-100
		potionitem=potionitem+1 #Comments can only be placed inline when there is an indentation
		actionresult="Potion bought!"
	else:
		actionresult="Not enough gold!"
else:
	actionresult="Nothing to do."`
}

function test2(){
	codetext.value = 
`array a[4]
a[2]=a[0]+a[1]+a[2]
a[1]=a[1]+3
if a[1]>100:
	a[1]=a[1]-10
	a[2]=a[2]*2
	a[0]=42
elif a[1]>10:
	a[1]=a[1]-1
	a[2]=a[2]/2
else:
	a[2]=a[2]/2`;
}

function run(){
	/** @type {string?} */
	var sourcecode = codetext.value;
	if(!sourcecode){
		return;
	}
	sourcecode = sourcecode.replaceAll("\r\n","\n"); //Replaces newline and tabs to space
	//Get the first statement before we process the ##DEFINE tag
	var firststatement = sourcecode.split("\n",1)[0];
	if(!firststatement.startsWith("array ")){
		errmsg.value = "ERROR: Code must start with \"array\"";
	}
	//Parse the first statement to get the variable name and element count
	var varcode = firststatement.split(" ",2)[1]
	var varname = varcode.split("[",1)[0]
	var varelemcount = parseInt(varcode.split("[",2)[1].split("]",1)[0])
	if(isNaN(varelemcount)||varelemcount<=0||varelemcount>Number.MAX_SAFE_INTEGER){
		errmsg.value = "ERROR: Invalid element count.";
	}
	
	//Replace all the \n into spaces and removes beginning and trailing whitespace between ;
	//Kinda like trim(), but whatever.
	
	{
		const defmatcher = /^##DEFINE (\S+) (\S+)/gm;
		/** @type {RegExpExecArray?} */
		var defmatchres;
		const defs = Object.create(null);
		while((defmatchres = defmatcher.exec(sourcecode)) != null){
			defs[defmatchres[1]]=defmatchres[2];
		}
		if(Object.keys(defs).length>0){
			sourcecode = sourcecode.replace(new RegExp(Object.keys(defs).join("|"),"g"), function(match){
				return defs[match];
			});
		}
	}
	sourcecode = sourcecode.replaceAll(/#.*/ig,""); //Removes comments with #
	//sourcecode = sourcecode.replaceAll(/(\s+\;)|(\;\s+)/ig,";"); //Removes all whitespace infront or behind the semicolon
	//sourcecode = sourcecode.replaceAll(/(\s+\{)|(\{\s+)/ig,"{"); //Removes all whitespace infront or behind the open curly bracket
	//sourcecode = sourcecode.replaceAll(/(\s+\})|(\}\s+)/ig,"}"); //Removes all whitespace infront or behind the close curly bracket

	var statements = sourcecode.split("\n");
	//statements = statements.filter((stmt)=>stmt.length>0); //Don't remove lines, we need them to keep track of errors at certain lines
	statements = statements.map((stmt)=>stmt.trimEnd());
	console.log(sourcecode); //For debugging purposes
	
	//Initialize variable substitutions based from the variable name and element count
	/**
	 * @param {string} name 
	 * @param {number} elemcount 
	 * @returns {string[]}
	 */
	function createinitialvars(name,elemcount){
		return Array.from({length: elemcount}, (_v,i) => `${name}[${i}]`);
	}
	/* for(let i = 0;i<varelemcount;i++){
		varb.push([varname,"[",i,"]"].join(""));
	} */
	console.log(statements);
	//
	/**Contains a stack of arrays of variable substitutions.
	 * 
	 * A variable substitution `[string|null,string[]]` is a tuple of a `string|null` representing the condition, and a `string[]` (with length of the number of variables) representing the substitutions for each variables.
	 * The tuple `[string,string[]]` represent the if/elif statement. The tuple `[null,string[]]` represents an else statement.
	 * 
	 * An array of variable substitutions `[string|null,string[]][]` is an array of `[string|null,string[]]` representing the stack of if-elif-else statements.
	 * The first element represents an if statement, and the subsequent elements represents subsequent elif statements. Else statement `[null,string[]]` can only be placed at the last element.
	 * 
	 * A stack of arrays of variable substitutions `[string|null,string[]][][]` is a stack of `[string|null,string[]][]` where each element represents the depth level of the statement.
	 * The first element represents depth level 0 or indentation level 0.
	 * 
	 * Example of 
	 * 
	 * varsubarr1 = [[null.[varsub1]]] //First array always contains only one element
	 * 
	 * varsubarr2 = [["condition1".[varsub1]],["condition2".[varsub2]],["condition3".[varsub3]],[null.[varsub4]]]
	 * 
	 * varsubarr3 = [["condition1".[varsub1]],[null.[varsub2]]]
	 * 
	 * varsubarr_stack = [varsubarr1,varsubarr2,varsubarr3]
	 * @type {[string|null,string[]][][]} */
	var varsubarr_stack = [[[null,createinitialvars(varname,varelemcount)]]];
	/**Checks whether indentation level matches with stack level
	 * 
	 * At indentation level 0, the stack should contain 1 element (depth level 0)
	 * 
	 * At indentation level 2, the stack should contain 3 element (depth level 0, depth level 1, depth level 2)
	 * 
	 * At indentation level n, the stack should contain n+1 element
	 * 
	 * At indentation level 1 and stack level 1, this indicates unexpected indent and the function returns -1
	 * 
	 * At indentation level 0 and stack level 2, this indicates that the code has left the if-else statement and the function returns 1
	 * 
	 * @param {number} indent_lvl
	 * @returns {number} 0 if matches, negative if indent level is lower than stack level (unexpected indent), positive if indent level is higher than stack level
	 */
	function checkindentlevel(indent_lvl){
		return varsubarr_stack.length-1-indent_lvl;
	}
	/**Checks whether the array of variable substitutions contains an "else" statement at the last element.
	 * 
	 * @param {[string | null, string[]][]} varsubarr
	 * @returns True if the array of variable substitutions contains an "else" statement at the last element.
	 */
	function checkelse_varsubarr(varsubarr){
		return varsubarr[varsubarr.length-1][0]==null;
	}
	/**Returns the n-th element of the stack of arrays of variable substitutions, based on the n-th indent level.
	 * @param {number} indent_lvl
	 * @returns {[string | null, string[]][]} An array of variable substitutions on the n-th indent level*/
	function get_varsubarr_stack(indent_lvl){
		return varsubarr_stack[indent_lvl];
	}
	/**Returns the last element of the given array of variable substitutions. Note that the array is not a stack, and the naming is only for the sake of consistency.
	 * @param {[string | null, string[]][]} varsubarr
	 * @returns {[string | null, string[]]} The last element of the array of variable substitutions*/
	function peek_varsubarr(varsubarr){
		return varsubarr[varsubarr.length-1];
	}
	/**Returns the topmost element of the stack of arrays of variable substitutions without popping it.
	 * @returns {[string | null, string[]][]} The last element of the stack of arrays of variable substitutions*/
	function peek_varsubarr_stack(){
		return varsubarr_stack[varsubarr_stack.length-1];
	}
	/**This variable is supposed to hold the string substitutions of the last element of the array of variable substitutions on the current indent level. Use for variable substitutions!
	 * @type {string[]} */
	var cur_varsubstr = peek_varsubarr(peek_varsubarr_stack())[1];
	var curindentlvl = 0;
	const indentmatcher = /^\t*/;
	var varmatcher = new RegExp(varname+"\\[(\\d*)\\]","gi");
	// var varmatcher = /\[(\d+)\]/g
	for(let line = 0; line < statements.length + 1; line++){
		try {
			var stmt = line < statements.length ? statements[line] : "";
			indentmatcher.lastIndex = 0; //Reset the regex state before reusing on other strings
			var tabs = indentmatcher.exec(stmt)[0];
			/** The indentation level of the current statement. Lowest is 0. */
			var indentlvl = tabs.length;
			/**This should be 1 in elif/else statement, 0 for everywhere else*/
			var indentlvldiff = checkindentlevel(indentlvl);
			stmt = stmt.slice(indentlvl)
			if(indentlvldiff<0){
				//Unexpected indentation!
				throw `ERROR: unexpected indentation at line ${line+1}`;
			}
			while(indentlvldiff>0){
				var poppedvarsubarr = varsubarr_stack.pop();
				if(!poppedvarsubarr){
					throw "ERROR: varsubarr_stack is empty. This should not happen. Report this error to the developer."
				}
				indentlvldiff = checkindentlevel(indentlvl);
				if(indentlvldiff==0 && (stmt.startsWith("else") || stmt.startsWith("elif "))){
					//We need the array for the subsequent elif/else statements! Put it back!
					varsubarr_stack.push(poppedvarsubarr);
					break;
				}
				//else, pop the stack
				
				/*
				 *	a[2]=a[0]+a[1]+a[2]
				 *	a[1]=a[1]+3
				 *	#[a[0],a[1]+3,a[0]+a[1]+a[2]]
				 *	if a[1]>2:
				 *		a[1]=a[1]-1
				 *	else:
				 *		a[2]=a[2]/2
				 *	#condition: a[1]>2
				 *	#[a[0],a[1]-1,a[2]]
				 *	#[a[0],a[1],a[2]/2]
				 *	#since only a[1] and a[2] gets modified, they get the if treatment.
				 *	#condition is a[1]>2, which gets substituted with a[1]+3, making it (a[1]+3)>2
				 *	
				 *	#[a[0],(a[1]+3)>2?(a[1]+3)-1:a[1]+3,(a[1]+3)>2?a[0]+a[1]+a[2]:(a[0]+a[1]+a[2])/2]
				 */
				cur_varsubstr = peek_varsubarr(peek_varsubarr_stack())[1];
				if(!checkelse_varsubarr(poppedvarsubarr)){
					poppedvarsubarr.push([null,createinitialvars(varname,varelemcount)]) //Quick-fix for else-less statement
				}
				for(let varsub_idx = 0; varsub_idx<poppedvarsubarr.length;varsub_idx++){
					var condition = poppedvarsubarr[varsub_idx][0];
					if(condition){
						var conditionsubbed = substitutevariable(condition,cur_varsubstr,varmatcher);
						poppedvarsubarr[varsub_idx][0] = conditionsubbed;
					}
					for(let i = 0;i<varelemcount;i++){
						var value = poppedvarsubarr[varsub_idx][1][i];
						var valuesubbed = substitutevariable(value,cur_varsubstr,varmatcher)
						poppedvarsubarr[varsub_idx][1][i] = valuesubbed;
					}
				}
				do{
					var cur_value = peek_varsubarr(peek_varsubarr_stack())[1];
					if(poppedvarsubarr.length>2){
						cur_value = poppedvarsubarr[poppedvarsubarr.length-2][1];
					}
					var condition = poppedvarsubarr[0][0];
					/** @type {string[]} */
					var values1 = poppedvarsubarr[0][1];
					/** @type {string[]} */
					var values2 = cur_varsubstr;
					if(poppedvarsubarr.length>=2){
						condition = poppedvarsubarr[poppedvarsubarr.length-2][0];
						values1 = poppedvarsubarr[poppedvarsubarr.length-2][1];
						values2 = poppedvarsubarr[poppedvarsubarr.length-1][1];
					}
					var cur_value_temp = Array.from(cur_value);
					var valuemask = Array.from({length: varelemcount}, (_v,i) => values1[i] != values2[i]);
					//console.log("Value mask",valuemask)
					for(let i = 0;i<varelemcount;i++){
						if(!valuemask[i]){
							cur_value_temp[i] = `${values1[i]}`
							continue;
						}
						//console.log(`${condition}?${values1[i]}:${values2[i]}`)
						cur_value_temp[i] = `(${condition}?${values1[i]}:${values2[i]})`
					}
					for(let i = 0;i<varelemcount;i++){
						cur_value[i] = cur_value_temp[i]; //Copy values back to the original variable
					}
					poppedvarsubarr.pop()
				} while(poppedvarsubarr.length>=2);
				
			}
			//Begin parsing statements here
			/* if(indentlvl>0){
				curvarsubs = [indentlvl-1][2] == null ? [indentlvl-1][1]:[indentlvl-1][2];
			}
			else{
				curvarsubs = ;
			} */
			indentlvldiff = checkindentlevel(indentlvl);
			
			cur_varsubstr = peek_varsubarr(get_varsubarr_stack(indentlvl))[1];
			if(stmt.startsWith("if ")){
				if(indentlvldiff!=0){
					throw `ERROR: Unexpected if statement at line ${line+1}.` //not possible, this should already be caught on the first check
				}
				/*Some helpful visualizations
				#X
				if: #indentlvl = 0
					#A1
				elif:
					#A2
				else:
					#A3
					if: #indentlvl = 1
						#B
						if:
							#C
				 = 
				 = [X,A1A2A3,B,C]
				*/
				
				var condition = stmt.slice(stmt.indexOf(" ")).split(":",1)[0].trim()
				//Validate condition
				if(condition.length == 0){
					throw `ERROR: Expected condition after if statement at line ${line+1}.` //if statement without condition
				}
				if(!isvalidvariable(condition,cur_varsubstr,varmatcher)){
					throw `ERROR: Invalid array index at line ${line+1}.`
				}
				varsubarr_stack.push([]);
				peek_varsubarr_stack().push([condition,createinitialvars(varname,varelemcount)])
			}
			else if(stmt.startsWith("elif ")){
				if(indentlvldiff!=1){
					throw `ERROR: Unexpected elif statement at line ${line+1}.` //elif statement before if statement
				}
				if(checkelse_varsubarr(get_varsubarr_stack(indentlvl+1))){
					throw `ERROR: Unexpected elif statement at line ${line+1}.` //elif statement after else statement
				}
				var condition = stmt.slice(stmt.indexOf(" ")).split(":",1)[0].trim()
				//Validate condition
				if(condition.length == 0){
					throw `ERROR: Expected condition after elif statement at line ${line+1}.` //elif statement without condition
				}
				if(!isvalidvariable(condition,cur_varsubstr,varmatcher)){
					throw `ERROR: Invalid array index at line ${line+1}.`
				}
				peek_varsubarr_stack().push([condition,createinitialvars(varname,varelemcount)]);
			}
			else if(stmt.startsWith("else")){
				if(indentlvldiff!=1){
					throw `ERROR: Unexpected else statement at line ${line+1}.` //else statement before if statement
				}
				if(checkelse_varsubarr(get_varsubarr_stack(indentlvl+1))){
					throw `ERROR: Unexpected else statement at line ${line+1}.` //else statement after else statement
				}
				peek_varsubarr_stack().push([null,createinitialvars(varname,varelemcount)]);
			}
			else{
				//assignment operator
				var assignopindex = stmt.indexOf("=");
				if(assignopindex == -1){
					continue;
				}
				varmatcher.lastIndex = 0;
				var assignee = stmt.slice(0,assignopindex).trim();
				var value = stmt.slice(assignopindex+1).trim();
				var assigneematchres = varmatcher.exec(assignee)
				varmatcher.lastIndex = 0; //Reset the regex state before reusing on other strings
				if(!assigneematchres || assigneematchres[0] != assignee){
					throw `ERROR: Invalid assignee at line ${line+1}.`; //Invalid assignee variable
				}
				var assigneeindex = parseInt(assigneematchres[1])
				if(isNaN(assigneeindex)||assigneeindex<0||assigneeindex>=cur_varsubstr.length){
					throw `ERROR: Invalid array index at line ${line+1}.`; //Invalid array index in assignee
				}
				if(!isvalidvariable(value,cur_varsubstr,varmatcher)){
					throw `ERROR: Invalid array index at line ${line+1}.`; //Invalid array index in value
				}
				//console.log("Current variables",curvarsubs);
				//console.log("Set variable in index",assigneeindex,"with",value);
				//Variable substitution happens here
				var valuesubbed = substitutevariable(value,cur_varsubstr,varmatcher)
				//Assignment happens here
				cur_varsubstr[assigneeindex] = valuesubbed //Since only one variable is changed, we can directly modify the curvar
				//console.log("Current variables (after)",curvarsubs);
			}
		} catch (error) {
			if (typeof error == "string") {
				errmsg.value = error
			}
			else{
				throw error;
			}
			return;
		}
	}
	/* var instructions = parsecode(sourcecode);
	console.log("before simplification",instructions);
	//let statements = simplifyinstructions(instructions);
	console.log("after simplification",statements);
	var output = "["+variables.join(", ")+"]";
	if(Object.keys(statements).length>0){
		output = output.replace(new RegExp(Object.keys(statements).map(key=>key.replace(/[-\/\\^$*+?.()|[\]{}]/g,"\\$&")).join("|"),"gi"),(m)=>statements[m])
	}
	result.value = output; */
	result.value = `[${get_varsubarr_stack(0)[0][1]}]`;
}