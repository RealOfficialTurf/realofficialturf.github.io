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

function debugstringpos(string,pos){
	return string+"\n"+" ".repeat(pos)+"^";
}

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
				throw `ERROR: Out of bound detected. This should not happen. Report this error to the developer.`; //No variable detected
			}
			let substituent = substituents[id]; //as_idx is string but it gets implicitly converted?!
			console.log("Instances of",match,"in",value,"will be substituted with",substituent)
			//No need parentheses if substituent is same as match
			return match == substituent ? match : `(${substituent})`;
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

console.log("Test!")

function test1(){
	codetext.value = 
`global abcxyz[3]
abcxyz[1]=abcxyz[1]+3
abcxyz[2]=abcxyz[0]+abcxyz[1]+abcxyz[2]
#[a[0],a[1]+3,a[0]+a[1]+a[2]]
abcxyz[0]=abcxyz[1]*4
#number 0 is replaced with abcxyz[1]*4, in which abcxyz[1] gets replaced with (abcxyz[1]+3), making it (abcxyz[1]+3)*4
#In order words, abcxyz[1] is instance to be substituted, abcxyz[1]*4 is the value to look for such instances, and abcxyz[1]+3 is the substituent
#[(abcxyz[1]+3)*4,abcxyz[1]+3,abcxyz[0]+abcxyz[1]+abcxyz[2]]
##DEFINE abcxyz a`
}

function test2(){
	codetext.value = 
`global a[4]
a[2]=a[0]+a[1]+a[2]
a[1]=a[1]+3
#[a[0],a[1]+3,a[0]+a[1]+a[2],a[3]]
if a[1]>2:
	a[1]=a[1]-1
else:
	a[2]=a[2]/2
#condition: a[1]>2
#[a[0],a[1]-1,a[2],a[3]]
#[a[0],a[1],a[2]/2,a[3]]
#since only a[1] and a[2] gets modified, they get the if treatment.
#condition is a[1]>2, which gets substituted with a[1]+3, making it (a[1]+3)>2
#[a[0],(a[1]+3)>2?(a[1]+3)-1:a[1]+3,(a[1]+3)>2?a[0]+a[1]+a[2]:(a[0]+a[1]+a[2])/2,a[3]]`;
}

function run(){
	//Replace all the \n into spaces and removes beginning and trailing whitespace between ;
	//Kinda like trim(), but whatever.
	/** @type {string?} */
	var sourcecode = codetext.value;
	if(!sourcecode){
		return;
	}
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
	sourcecode = sourcecode.replaceAll("\r\n","\n"); //Replaces newline and tabs to space
	//sourcecode = sourcecode.replaceAll(/(\s+\;)|(\;\s+)/ig,";"); //Removes all whitespace infront or behind the semicolon
	//sourcecode = sourcecode.replaceAll(/(\s+\{)|(\{\s+)/ig,"{"); //Removes all whitespace infront or behind the open curly bracket
	//sourcecode = sourcecode.replaceAll(/(\s+\})|(\}\s+)/ig,"}"); //Removes all whitespace infront or behind the close curly bracket
	var statements = sourcecode.split("\n");
	//statements = statements.filter((stmt)=>stmt.length>0); //Don't remove lines, we need them to keep track of errors at certain lines
	statements = statements.map((stmt)=>stmt.trimEnd());
	console.log(sourcecode); //For debugging purposes
	//Get the first statement!
	if(!statements[0].startsWith("global ")){
		throw "ERROR: Code must start with \"global\"";
	}
	//Parse the first statement to get the variable name and element count
	var varcode = statements[0].split(" ",2)[1]
	var varname = varcode.split("[",1)[0]
	var varelemcount = parseInt(varcode.split("[",2)[1].split("]",1)[0])
	if(isNaN(varelemcount)||varelemcount<=0||varelemcount>Number.MAX_SAFE_INTEGER){
		throw "ERROR: Invalid element count.";
	}
	//Initialize variable substitutions based from the variable name and element count
	/**
	 * @param {string} name 
	 * @param {number} elemcount 
	 * @returns {string[]}
	 */
	function createinitialvars(name,elemcount){
		return Array.from({length: elemcount}, (_v,i) => `${name}[${i}]`);
	}
	/** @type {string[]} */
	var varsubs = createinitialvars(varname,varelemcount);
	//Generate variables
	
	/* for(let i = 0;i<varelemcount;i++){
		varb.push([varname,"[",i,"]"].join(""));
	} */
	console.log(varsubs);
	//Execute order si- I mean, execute the statements!
	console.log(statements);
	//
	/** @type {[string,string[],string[]|null][]} */
	var condvarsubsstack = [];
	/** @type {string[]?} */
	var curvarsubs = null;
	var curindentlvl = 0;
	const indentmatcher = /^\t*/;
	var varmatcher = new RegExp(varname+"\\[(\\d*)\\]","gi");
	// var varmatcher = /\[(\d+)\]/g
	for(let line = 0; line < statements.length + 1; line++){
		try {
			var stmt = line < statements.length ? statements[line] : "";
			indentmatcher.lastIndex = 0; //Reset the regex state before reusing on other strings
			var tabs = indentmatcher.exec(stmt)[0];
			var indentlvl = tabs.length;
			stmt = stmt.slice(indentlvl)
			if(indentlvl > curindentlvl){
				//Unexpected indentation!
				throw `ERROR: unexpected indentation at line ${line+1}`;
			}
			while(indentlvl < curindentlvl){
				curindentlvl--; //It'll be reincremented again when we find else statement
				if(indentlvl == curindentlvl && stmt.startsWith("else")){
					//Don't pop the stack! We need the item in the current level of the stack
					break;
				}
				//else, pop the stack
				var poppedcondvarsubs = condvarsubsstack.pop()
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
				curvarsubs = varsubs;
				if(curindentlvl>0){
					curvarsubs = condvarsubsstack[curindentlvl-1][2] ? condvarsubsstack[curindentlvl-1][2]:condvarsubsstack[curindentlvl-1][1];
				}
				if(!curvarsubs){
					throw "ERROR: Substitution array is null. This should not happen. Report this error to the developer."
				}
				var curvarcopy = Array.from(curvarsubs);
				var condition = poppedcondvarsubs[0];
				var values1 = poppedcondvarsubs[1];
				var values2 = poppedcondvarsubs[2];
				var conditionsubbed = substitutevariable(condition,curvarsubs,varmatcher);
				if(values2){
					var valuemask = Array.from({length: varelemcount}, (_v,i) => `${varname}[${i}]` != values1[i] || `${varname}[${i}]` != values2[i]);
				}
				else{
					var valuemask = Array.from({length: varelemcount}, (_v,i) => `${varname}[${i}]` != values1[i]);
				}
				console.log("Value mask",valuemask)
				for(let i = 0;i<varelemcount;i++){
					if(!valuemask[i]){
						continue;
					}
					var value1 = values1[i];
					var valuesubbed1 = substitutevariable(value1,curvarsubs,varmatcher)
					var valuesubbed2 = curvarsubs[i];
					if(values2){
						var value2 = values2[i];
						var valuesubbed2 = substitutevariable(value2,curvarsubs,varmatcher)
					}
					console.log(valuesubbed1,valuesubbed2)
					console.log(`${conditionsubbed}?${valuesubbed1}:${valuesubbed2}`)
					curvarcopy[i] = `(${conditionsubbed}?${valuesubbed1}:${valuesubbed2})`
				}
				for(let i = 0;i<varelemcount;i++){
					curvarsubs[i] = curvarcopy[i]; //Copy values back to the original variable
				}
			}
			//Begin parsing statements here
			if(indentlvl>0){
				curvarsubs = condvarsubsstack[indentlvl-1][2] == null ? condvarsubsstack[indentlvl-1][1]:condvarsubsstack[indentlvl-1][2];
			}
			else{
				curvarsubs = varsubs;
			}
			if(stmt.startsWith("if ")){
				/*Some helpful visualizations
				#X
				if: #indentlvl = 0
					#A
					if: #indentlvl = 1
						#B
						if:
							#C
				varsubs = X
				condvarsubsstack = [A,B,C]
				*/
				var condition = stmt.split(" ",2)[1].split(":",1)[0].trim()
				//Validate condition
				if(condition.length == 0){
					throw `ERROR: Expected condition after if statement at line ${line+1}.`
				}
				if(!isvalidvariable(condition,curvarsubs,varmatcher)){
					throw `ERROR: Invalid array index at line ${line+1}.`
				}
				condvarsubsstack.push([condition,createinitialvars(varname,varelemcount),null])
				curindentlvl++;
			}
			else if(stmt.startsWith("else")){
				if(condvarsubsstack.length < indentlvl + 1){
					throw `ERROR: Unexpected else statement at line ${line+1}.`//If-less else statement
				}
				if(condvarsubsstack[condvarsubsstack.length-1][2] != null){
					throw `ERROR: Unexpected else statement at line ${line+1}.`//Extra else statement
				}
				condvarsubsstack[condvarsubsstack.length-1][2] = createinitialvars(varname,varelemcount);
				curindentlvl++;
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
				if(isNaN(assigneeindex)||assigneeindex<0||assigneeindex>=curvarsubs.length){
					throw `ERROR: Invalid array index at line ${line+1}.`; //Invalid array index in assignee
				}
				if(!isvalidvariable(value,curvarsubs,varmatcher)){
					throw `ERROR: Invalid array index at line ${line+1}.`; //Invalid array index in value
				}
				//console.log("Current variables",curvarsubs);
				//console.log("Set variable in index",assigneeindex,"with",value);
				//Variable substitution happens here
				var valuesubbed = substitutevariable(value,curvarsubs,varmatcher)
				//Assignment happens here
				curvarsubs[assigneeindex] = valuesubbed //Since only one variable is changed, we can directly modify the curvar
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
	result.value = `[${curvarsubs}]`;
}